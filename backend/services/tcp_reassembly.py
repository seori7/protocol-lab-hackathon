"""Восстановление одного направленного TCP-потока из наблюдавшихся сегментов.

Модуль не определяет границы прикладных сообщений: TCP предоставляет поток
байтов, а фрейминг протокола — отдельная задача.
"""

from __future__ import annotations

from array import array
from typing import Any, Iterable


TCP_SEQUENCE_MODULUS = 1 << 32
TCP_SEQUENCE_HALF_RANGE = 1 << 31

MAX_REASSEMBLY_SPAN_BYTES = 1024 * 1024

UNKNOWN_FRAME_NUMBER = 0


class ReassemblyLimitError(ValueError):
    """Диапазон потока слишком велик для текущего алгоритма."""


class ReassemblyInputError(ValueError):
    """Входные сегменты некорректны или их порядок seq неоднозначен."""


def _relative_sequence(sequence: int, reference: int) -> int:
    """Разворачивает 32-битный TCP seq относительно первого сегмента.

    Работает, пока рассматриваемый диапазон меньше половины пространства
    TCP sequence numbers. При большем диапазоне порядок без дополнительного
    контекста нельзя определить этим способом.
    """
    return (
        (sequence - reference + TCP_SEQUENCE_HALF_RANGE)
        % TCP_SEQUENCE_MODULUS
    ) - TCP_SEQUENCE_HALF_RANGE


def reassemble_direction(
    packets: Iterable[dict[str, Any]],
    *,
    max_span_bytes: int = MAX_REASSEMBLY_SPAN_BYTES,
) -> dict[str, Any]:
    """Восстанавливает наблюдаемые байты одного направления соединения.

    Ожидает словари из PcapParser: seq, payload_hex и frame_number.
    `start_offset`/`end_offset` относятся к НАБЛЮДАЕМОМУ диапазону, причём
    `end_offset` исключителен. Недоступное начало соединения здесь
    не угадывается.

    Первое увиденное значение байта остаётся основным; отличающееся
    повторное значение возвращается как конфликт.
    """
    if max_span_bytes <= 0:
        raise ValueError("max_span_bytes должен быть положительным")

    segments: list[tuple[int, int, bytes]] = []

    for packet in packets:
        try:
            sequence = int(packet["seq"])
            frame_number = int(packet["frame_number"])
            payload = bytes.fromhex(packet["payload_hex"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ReassemblyInputError(
                "Сегменту нужны корректные seq, frame_number и payload_hex"
            ) from exc

        if not 0 <= sequence < TCP_SEQUENCE_MODULUS:
            raise ReassemblyInputError("TCP seq должен быть 32-битным")
        if frame_number <= UNKNOWN_FRAME_NUMBER:
            raise ReassemblyInputError("Номер исходного кадра должен быть > 0")
        if not payload:
            continue

        segments.append((sequence, frame_number, payload))

    if not segments:
        return {
            "sequence_base": None,
            "span_bytes": 0,
            "known_bytes": 0,
            "parts": [],
            "conflicts": [],
            "overlap_policy": "first_observed",
        }

    reference_sequence = segments[0][0]
    positioned = [
        (
            _relative_sequence(sequence, reference_sequence),
            frame_number,
            payload,
        )
        for sequence, frame_number, payload in segments
    ]

    minimum_relative = min(start for start, _, _ in positioned)
    maximum_relative_end = max(
        start + len(payload) for start, _, payload in positioned
    )
    span = maximum_relative_end - minimum_relative

    if span > max_span_bytes:
        raise ReassemblyLimitError(
            f"Диапазон направленного потока {span} байт превышает "
            f"защитный предел {max_span_bytes} байт; данные не обрезаны"
        )

    values = bytearray(span)
    present = bytearray(span)
    source_frames = array("I", [UNKNOWN_FRAME_NUMBER]) * span
    conflicts: list[dict[str, int]] = []

    for relative_start, frame_number, payload in positioned:
        stream_start = relative_start - minimum_relative

        for byte_index, value in enumerate(payload):
            offset = stream_start + byte_index

            if not present[offset]:
                present[offset] = 1
                values[offset] = value
                source_frames[offset] = frame_number
            elif values[offset] != value:
                conflicts.append(
                    {
                        "offset": offset,
                        "first_frame_number": source_frames[offset],
                        "other_frame_number": frame_number,
                        "first_byte": values[offset],
                        "other_byte": value,
                    }
                )

    parts: list[dict[str, Any]] = []
    cursor = 0

    while cursor < span:
        start = cursor
        is_present = bool(present[cursor])
        source = source_frames[cursor] if is_present else None
        cursor += 1

        while cursor < span:
            if bool(present[cursor]) != is_present:
                break
            if is_present and source_frames[cursor] != source:
                break
            cursor += 1

        if is_present:
            parts.append(
                {
                    "kind": "data",
                    "start_offset": start,
                    "end_offset": cursor,
                    "payload_hex": values[start:cursor].hex().upper(),
                    "frame_number": source,
                }
            )
        else:
            parts.append(
                {
                    "kind": "gap",
                    "start_offset": start,
                    "end_offset": cursor,
                    "length": cursor - start,
                }
            )

    return {
        "sequence_base": (
            reference_sequence + minimum_relative
        ) % TCP_SEQUENCE_MODULUS,
        "span_bytes": span,
        "known_bytes": sum(present),
        "parts": parts,
        "conflicts": conflicts,
        "overlap_policy": "first_observed",
    }