"""API для восстановленных направленных TCP-потоков.

Этот маршрут добавлен отдельно от routes.py, чтобы не менять действующий
контракт списка пакетов до подключения нового интерфейса.
"""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from services.parser import PcapParser
from services.tcp_reassembly import (
    ReassemblyInputError,
    ReassemblyLimitError,
    reassemble_direction,
)


router = APIRouter()

UPLOAD_DIRECTORY = Path(__file__).resolve().parents[1] / "uploads"

CAPTURE_EXTENSIONS = (".pcap", ".pcapng")
STREAM_DIRECTIONS = ("client_to_server", "server_to_client")


def find_capture_file(project_id: UUID) -> Path:
    """Находит ранее загруженный PCAP по UUID, не принимая путь от клиента."""
    for extension in CAPTURE_EXTENSIONS:
        candidate = UPLOAD_DIRECTORY / f"{project_id}{extension}"
        if candidate.is_file():
            return candidate

    raise HTTPException(
        status_code=404,
        detail="Исходная запись проекта не найдена",
    )


def build_streams_response(capture_path: Path, session_id: str) -> dict:
    """Один раз читает запись и собирает оба направления выбранной сессии.

    Функция синхронная: чтение файла и восстановление байтов выполняются
    в рабочем потоке через run_in_threadpool, а не блокируют цикл FastAPI.
    """
    sessions = PcapParser.extract_tcp_sessions(str(capture_path))
    session = sessions.get(session_id)

    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"TCP-сессия {session_id!r} не найдена в записи",
        )

    packets = session["packets"]
    streams: dict[str, dict] = {}

    for direction in STREAM_DIRECTIONS:
        direction_packets = [
            packet
            for packet in packets
            if packet["direction"] == direction
        ]

        streams[direction] = reassemble_direction(direction_packets)

    return {
        "project_id": capture_path.stem,
        "session_id": session_id,
        "role_status": session.get("role_status", "unknown"),
        "warning": session.get("warning"),
        "streams": streams,
        "limitations": [
            "Границы прикладных сообщений пока не определяются.",
            "TCP checksum этим анализом не проверяется.",
            "При конфликте first_observed — политика отображения, "
            "а не доказательство правильности выбранного байта.",
        ],
    }


@router.get("/project/{project_id}/sessions/{session_id}/streams")
async def get_directional_streams(
    project_id: UUID,
    session_id: str,
) -> dict:
    """Отдаёт результат TCP-восстановления для выбранной сессии."""
    capture_path = find_capture_file(project_id)

    try:
        return await run_in_threadpool(
            build_streams_response,
            capture_path,
            session_id,
        )
    except HTTPException:
        raise
    except ReassemblyLimitError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except ReassemblyInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Не удалось разобрать запись: {exc}",
        ) from exc