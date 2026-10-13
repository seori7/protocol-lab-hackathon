import os
from scapy.utils import PcapReader
from scapy.layers.inet import IP, TCP
from scapy.packet import Raw

class PcapParser:
    """
    Класс для разбора PCAP и восстановления TCP-сессий через библиотеку Scapy.
    """

    @staticmethod
    def extract_tcp_sessions(filepath: str) -> dict:
        """
        Читает файл и группирует пакеты по TCP-сессиям.
        Возвращает словарь: { "session_id": { "metadata": {...}, "packets": [...] } }
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Файл {filepath} не найден.")

        # Словарь для хранения сессий
        sessions = {}
        
        try:
            # PcapReader читает файл потоково, не забивая оперативную память
            with PcapReader(filepath) as pcap_reader:
                for packet in pcap_reader:
                    # Пакет должен иметь слои IP, TCP и полезную нагрузку (Raw)
                    if packet.haslayer(IP) and packet.haslayer(TCP) and packet.haslayer(Raw):
                        
                        ip_src = packet[IP].src
                        ip_dst = packet[IP].dst
                        port_src = int(packet[TCP].sport)
                        port_dst = int(packet[TCP].dport)
                        seq = int(packet[TCP].seq) 
                        
                        raw_bytes = packet[Raw].load
                        raw_hex = raw_bytes.hex().upper() # Фронтенд ждет HEX в верхнем регистре
                        
                        # Создаем уникальный ID сессии
                        endpoint1 = f"{ip_src}:{port_src}"
                        endpoint2 = f"{ip_dst}:{port_dst}"
                        session_id = f"{min(endpoint1, endpoint2)}<->{max(endpoint1, endpoint2)}"
                        
                        # Направление
                        direction = "client_to_server" if port_src > port_dst else "server_to_client"

                        # Инициализируем сессию, если её еще нет
                        if session_id not in sessions:
                            sessions[session_id] = {
                                "id": session_id,
                                "endpoints": [endpoint1, endpoint2],
                                "packets": []
                            }

                        # Добавляем пакет
                        sessions[session_id]["packets"].append({
                            "timestamp": float(packet.time),
                            "direction": direction,
                            "seq": seq,
                            "payload_hex": raw_hex,
                            "anomaly": None, # Место для будущей бизнес-логики
                            "applied_rules": []
                        })

            # ПОСТОБРАБОТКА СЕССИЙ (Требование R1 из ТЗ - сортировка и удаление дубликатов)
            for s_id, session_data in sessions.items():
                # 1. Сортируем пакеты по времени, а при равном времени - по Sequence Number
                session_data["packets"].sort(key=lambda x: (x["timestamp"], x["seq"]))
                
                # 2. Удаляем TCP-дубликаты (Retransmissions)
                unique_packets = []
                seen_seqs = { "client_to_server": set(), "server_to_client": set() }
                
                # Переназначаем ID пакетам по порядку
                packet_counter = 1
                for pkt in session_data["packets"]:
                    if pkt["seq"] not in seen_seqs[pkt["direction"]]:
                        seen_seqs[pkt["direction"]].add(pkt["seq"])
                        pkt["id"] = packet_counter
                        unique_packets.append(pkt)
                        packet_counter += 1
                        
                session_data["packets"] = unique_packets

        except Exception as e:
            raise RuntimeError(f"Ошибка чтения PCAP: {str(e)}")

        return sessions