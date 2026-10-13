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


Endpoint = tuple[str, int]
EndpointPair = tuple[Endpoint, Endpoint]


@dataclass
class ActiveConnection:
    """Один наблюдаемый экземпляр TCP-соединения."""

    session: dict[str, Any]
    first_sender: Endpoint
    initial_syn_seq: int | None
    closed: bool = False


def make_endpoint_pair(source: Endpoint, destination: Endpoint) -> EndpointPair:
    """Создаёт одинаковый ключ для обоих направлений обмена."""
    first, second = sorted((source, destination))
    return first, second


class PcapParser:
    """Извлекает TCP-сессии и исходные payload-сегменты из PCAP/PCAPNG.

    ВАЖНО: возвращаемые packets — не восстановленные прикладные сообщения.
    Правильное восстановление потока по sequence numbers будет отдельным шагом.
    """

    @staticmethod
    def extract_tcp_sessions(filepath: str) -> dict[str, dict[str, Any]]:
        capture_path = Path(filepath)
        if not capture_path.is_file():
            raise FileNotFoundError(f"Файл {filepath} не найден.")

        sessions: dict[str, dict[str, Any]] = {}
        active_connections: dict[EndpointPair, ActiveConnection] = {}
        connection_counter = 0

        try:
            with PcapReader(str(capture_path)) as reader:
                for frame_number, frame in enumerate(reader, start=1):
                    if not frame.haslayer(IP) or not frame.haslayer(TCP):
                        continue

                    ip = frame[IP]
                    tcp = frame[TCP]

                    source: Endpoint = (str(ip.src), int(tcp.sport))
                    destination: Endpoint = (str(ip.dst), int(tcp.dport))
                    endpoint_pair = make_endpoint_pair(source, destination)

                    flags = int(tcp.flags)
                    sequence_number = int(tcp.seq)

                    is_initial_syn = bool(flags & TCP_FLAG_SYN) and not bool(
                        flags & TCP_FLAG_ACK
                    )

                    connection = active_connections.get(endpoint_pair)

                    is_repeated_syn = (
                        connection is not None
                        and not connection.closed
                        and is_initial_syn
                        and source == connection.first_sender
                        and sequence_number == connection.initial_syn_seq
                    )

                    if connection is None or (
                        is_initial_syn and not is_repeated_syn
                    ):
                        connection_counter += 1
                        session_id = f"tcp-{connection_counter}"

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
                            "warning": (
                                None
                                if is_initial_syn
                                else (
                                    "Начало TCP-соединения не наблюдалось. "
                                    "Обозначения C/S условные."
                                )
                            ),
                            "packets": [],
                        }

                        sessions[session_id] = session
                        connection = ActiveConnection(
                            session=session,
                            first_sender=source,
                            initial_syn_seq=(
                                sequence_number if is_initial_syn else None
                            ),
                        )
                        active_connections[endpoint_pair] = connection

                    assert connection is not None

                    payload = bytes(tcp.payload)
                    if payload:
                        direction = (
                            "client_to_server"
                            if source == connection.first_sender
                            else "server_to_client"
                        )

                        packet_id = len(connection.session["packets"]) + 1

                        connection.session["packets"].append(
                            {
                                "id": packet_id,
                                "frame_number": frame_number,
                                "timestamp": float(frame.time),
                                "direction": direction,
                                "seq": sequence_number,
                                "payload_len": len(payload),
                                "payload_hex": payload.hex().upper(),
                                "anomaly": None,
                                "applied_rules": [],
                            }
                        )

                    if flags & (TCP_FLAG_FIN | TCP_FLAG_RST):
                        connection.closed = True

        except Exception as exc:
            raise RuntimeError(
                f"Ошибка чтения PCAP/PCAPNG {capture_path.name}: {exc}"
            ) from exc

        return sessions