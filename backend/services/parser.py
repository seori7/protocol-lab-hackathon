from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scapy.layers.inet import IP, TCP
from scapy.utils import PcapReader


TCP_FLAG_FIN = 0x01
TCP_FLAG_SYN = 0x02
TCP_FLAG_RST = 0x04
TCP_FLAG_ACK = 0x10


@dataclass
class ActiveConnection:
    """Состояние одного обнаруженного экземпляра TCP-соединения."""

    session: dict[str, Any]
    initiator: tuple[str, int]
    initial_syn_seq: int | None
    closed: bool = False


class PcapParser:
    """Читает PCAP/PCAPNG и разделяет наблюдаемые TCP-соединения.

    ВАЖНО: этот класс пока НЕ восстанавливает направленный поток по
    sequence numbers. Поле packets содержит исходные кадры с payload
    в порядке наблюдения, а не готовые прикладные сообщения.
    """

    @staticmethod
    def extract_tcp_sessions(filepath: str) -> dict[str, dict[str, Any]]:
        capture_path = Path(filepath)

        if not capture_path.is_file():
            raise FileNotFoundError(f"Файл {filepath} не найден.")

        sessions: dict[str, dict[str, Any]] = {}
        active_by_endpoints: dict[
            tuple[tuple[str, int], tuple[str, int]],
            ActiveConnection,
        ] = {}

        connection_number = 0

        try:
            with PcapReader(str(capture_path)) as reader:
                for frame_number, frame in enumerate(reader, start=1):
                    if not frame.haslayer(IP) or not frame.haslayer(TCP):
                        continue

                    ip_layer = frame[IP]
                    tcp_layer = frame[TCP]

                    source = (str(ip_layer.src), int(tcp_layer.sport))
                    destination = (str(ip_layer.dst), int(tcp_layer.dport))

                    endpoint_key = tuple(sorted((source, destination)))

                    flags = int(tcp_layer.flags)
                    is_initial_syn = (
                        bool(flags & TCP_FLAG_SYN)
                        and not bool(flags & TCP_FLAG_ACK)
                    )

                    connection = active_by_endpoints.get(endpoint_key)

                    is_repeated_initial_syn = (
                        connection is not None
                        and not connection.closed
                        and is_initial_syn
                        and source == connection.initiator
                        and connection.initial_syn_seq == int(tcp_layer.seq)
                    )

                    should_start_new_connection = (
                        connection is None
                        or (
                            is_initial_syn
                            and not is_repeated_initial_syn
                        )
                    )

                    if should_start_new_connection:
                        connection_number += 1
                        session_id = f"tcp-{connection_number}"

                        role_status = (
                            "syn_observed" if is_initial_syn else "unknown"
                        )

                        session: dict[str, Any] = {
                            "id": session_id,
                            "endpoints": [
                                f"{source[0]}:{source[1]}",
                                f"{destination[0]}:{destination[1]}",
                            ],
                            "first_frame_number": frame_number,
                            "role_status": role_status,
                            "packets": [],
                        }

                        if role_status == "unknown":
                            session["warning"] = (
                                "Начало соединения не видно в записи. "
                                "Стороны C/S обозначены условно: первой "
                                "показана сторона первого наблюдаемого кадра."
                            )
                        else:
                            session["warning"] = None

                        sessions[session_id] = session
                        connection = ActiveConnection(
                            session=session,
                            initiator=source,
                            initial_syn_seq=(
                                int(tcp_layer.seq) if is_initial_syn else None
                            ),
                        )
                        active_by_endpoints[endpoint_key] = connection

                    assert connection is not None

                    payload = bytes(tcp_layer.payload)

                    if payload:
                        direction = (
                            "client_to_server"
                            if source == connection.initiator
                            else "server_to_client"
                        )

                        connection.session["packets"].append(
                            {
                                "id": frame_number,
                                "frame_number": frame_number,
                                "timestamp": float(frame.time),
                                "direction": direction,
                                "seq": int(tcp_layer.seq),
                                "payload_len": len(payload),
                                "payload_hex": payload.hex(),
                                "anomaly": None,
                            }
                        )

                    if flags & (TCP_FLAG_FIN | TCP_FLAG_RST):
                        connection.closed = True

        except Exception as exc:
            raise RuntimeError(
                f"Не удалось прочитать запись {capture_path.name}: {exc}"
            ) from exc

        return sessions