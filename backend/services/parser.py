import os
# Импортируем Scapy. PcapReader читает файл по одному пакету (экономит память!)
from scapy.utils import PcapReader
from scapy.layers.inet import TCP
from scapy.packet import Raw

class PcapParser:
    """
    Класс для работы с файлами PCAP/PCAPNG через библиотеку Scapy.
    """

    @staticmethod
    def extract_tcp_streams(filepath: str) -> list:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Файл {filepath} не найден.")

        packets_data = []
        
        try:
            # PcapReader не загружает весь файл в память, а читает его как поток
            with PcapReader(filepath) as pcap_reader:
                for i, packet in enumerate(pcap_reader):
                    # Нас интересуют только пакеты, где есть TCP и есть сырые данные (Raw)
                    if packet.haslayer(TCP) and packet.haslayer(Raw):
                        
                        # Извлекаем сырые байты и сразу переводим их в HEX-строку
                        raw_bytes = packet[Raw].load
                        raw_hex = raw_bytes.hex()
                        
                        src_port = int(packet[TCP].sport)
                        dst_port = int(packet[TCP].dport)
                        direction = "client_to_server" if src_port > dst_port else "server_to_client"

                        packets_data.append({
                            "id": i + 1,
                            # time в scapy хранится как Decimal, переводим в float
                            "timestamp": float(packet.time), 
                            "direction": direction,
                            "payload_hex": raw_hex,
                            "applied_rules": []
                        })
        except Exception as e:
            raise RuntimeError(f"Ошибка чтения PCAP через Scapy: {str(e)}")

        return packets_data