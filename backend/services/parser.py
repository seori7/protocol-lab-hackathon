import os
from scapy.utils import PcapReader
from scapy.layers.inet import IP, TCP
from scapy.packet import Raw

class PcapParser:
    """
    Класс для разбора PCAP, восстановления TCP-сессий и поиска сетевых аномалий.
    """

    @staticmethod
    def extract_tcp_sessions(filepath: str) -> dict:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Файл {filepath} не найден.")

        sessions = {}
        
        try:
            with PcapReader(filepath) as pcap_reader:
                for packet in pcap_reader:
                    if packet.haslayer(IP) and packet.haslayer(TCP) and packet.haslayer(Raw):
                        ip_src, ip_dst = packet[IP].src, packet[IP].dst
                        port_src, port_dst = int(packet[TCP].sport), int(packet[TCP].dport)
                        seq = int(packet[TCP].seq)
                        
                        raw_bytes = bytes(packet[Raw].load)
                        raw_hex = raw_bytes.hex()
                        payload_len = len(raw_bytes)
                        
                        endpoint1 = f"{ip_src}:{port_src}"
                        endpoint2 = f"{ip_dst}:{port_dst}"
                        session_id = f"{min(endpoint1, endpoint2)}<->{max(endpoint1, endpoint2)}"
                        direction = "client_to_server" if port_src > port_dst else "server_to_client"

                        if session_id not in sessions:
                            sessions[session_id] = {"id": session_id, "endpoints": [endpoint1, endpoint2], "packets": []}

                        sessions[session_id]["packets"].append({
                            "timestamp": float(packet.time),
                            "direction": direction,
                            "seq": seq,
                            "payload_len": payload_len,
                            "payload_hex": raw_hex,
                            "anomaly": None # Поле для записи проблем
                        })

            # --- ИНТЕЛЛЕКТУАЛЬНАЯ ПОСТОБРАБОТКА (TCP Reassembly & Anomaly Detection) ---
            for s_id, session_data in sessions.items():
                # 1. Сортируем пакеты
                session_data["packets"].sort(key=lambda x: (x["timestamp"], x["seq"]))
                
                unique_packets = []
                # Словари для отслеживания: какой seq мы ожидаем увидеть следующим
                expected_seqs = { "client_to_server": None, "server_to_client": None }
                # Словарь для поиска конфликтов (когда на один seq приходят РАЗНЫЕ данные)
                seen_payloads = { "client_to_server": {}, "server_to_client": {} }
                
                packet_counter = 1
                for pkt in session_data["packets"]:
                    dir_key = pkt["direction"]
                    current_seq = pkt["seq"]
                    hex_data = pkt["payload_hex"]
                    
                    # Проверка на дубликаты и конфликты (Требование файла 05_conflicting_overlap)
                    if current_seq in seen_payloads[dir_key]:
                        if seen_payloads[dir_key][current_seq] != hex_data:
                            pkt["anomaly"] = "conflicting_overlap (Конфликт данных)"
                            # Оставляем конфликтный пакет в списке для анализа
                        else:
                            continue # Обычный дубликат (retransmission), игнорируем
                    else:
                        seen_payloads[dir_key][current_seq] = hex_data

                    # Проверка на пропущенные сегменты (Требование файла 03_missing_segment)
                    if expected_seqs[dir_key] is not None:
                        if current_seq > expected_seqs[dir_key]:
                            pkt["anomaly"] = f"missing_segment (Потеряно {current_seq - expected_seqs[dir_key]} байт)"
                    
                    # Вычисляем, какой seq должен быть у следующего пакета
                    expected_seqs[dir_key] = current_seq + pkt["payload_len"]

                    pkt["id"] = packet_counter
                    unique_packets.append(pkt)
                    packet_counter += 1
                        
                session_data["packets"] = unique_packets

        except Exception as e:
            raise RuntimeError(f"Ошибка чтения PCAP: {str(e)}")

        return sessions