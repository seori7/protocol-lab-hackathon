import os
from scapy.utils import PcapReader
from scapy.layers.inet import IP, TCP
from scapy.packet import Raw


class PcapParser:
    """Разбор PCAP, TCP-сессии, reassembly + аномалии."""

    @staticmethod
    def extract_tcp_sessions(filepath: str) -> dict:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Файл {filepath} не найден.")

        sessions = {}
        try:
            with PcapReader(filepath) as reader:
                for packet in reader:
                    if not (packet.haslayer(IP) and packet.haslayer(TCP) and packet.haslayer(Raw)):
                        continue

                    ip_src = packet[IP].src
                    ip_dst = packet[IP].dst
                    port_src = int(packet[TCP].sport)
                    port_dst = int(packet[TCP].dport)
                    seq = int(packet[TCP].seq)

                    raw_bytes = bytes(packet[Raw].load)
                    raw_hex = raw_bytes.hex()
                    payload_len = len(raw_bytes)

                    endpoint1 = f"{ip_src}:{port_src}"
                    endpoint2 = f"{ip_dst}:{port_dst}"
                    session_id = f"{min(endpoint1, endpoint2)}<->{max(endpoint1, endpoint2)}"
                    direction = "client_to_server" if port_src > port_dst else "server_to_client"

                    if session_id not in sessions:
                        sessions[session_id] = {
                            "id": session_id,
                            "endpoints": [endpoint1, endpoint2],
                            "packets": [],
                        }

                    sessions[session_id]["packets"].append({
                        "timestamp": float(packet.time),
                        "direction": direction,
                        "seq": seq,
                        "payload_len": payload_len,
                        "payload_hex": raw_hex,
                        "anomaly": None,
                    })

            # Постобработка
            for session_data in sessions.values():
                session_data["packets"].sort(key=lambda x: (x["timestamp"], x["seq"]))

                unique = []
                expected = {"client_to_server": None, "server_to_client": None}
                seen = {"client_to_server": {}, "server_to_client": {}}
                counter = 1

                for pkt in session_data["packets"]:
                    d = pkt["direction"]
                    cur_seq = pkt["seq"]
                    hex_data = pkt["payload_hex"]

                    if cur_seq in seen[d]:
                        if seen[d][cur_seq] != hex_data:
                            pkt["anomaly"] = "conflicting_overlap (Конфликт данных)"
                        else:
                            continue  # retransmission
                    else:
                        seen[d][cur_seq] = hex_data

                    if expected[d] is not None and cur_seq > expected[d]:
                        pkt["anomaly"] = f"missing_segment (Потеряно {cur_seq - expected[d]} байт)"

                    expected[d] = cur_seq + pkt["payload_len"]
                    pkt["id"] = counter
                    unique.append(pkt)
                    counter += 1

                session_data["packets"] = unique

        except Exception as e:
            raise RuntimeError(f"Ошибка чтения PCAP: {str(e)}")

        return sessions