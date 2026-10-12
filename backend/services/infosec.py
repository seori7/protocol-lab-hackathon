import math

class InfoSecAnalyzer:
    """
    Модуль дополнительных ИБ-инструментов для реверс-инжиниринга.
    """

    @staticmethod
    def calculate_entropy(payload_hex: str) -> float:
        """
        Вычисляет энтропию Шеннона для HEX-строки.
        Возвращает значение от 0.0 до 8.0.
        """
        if not payload_hex:
            return 0.0
            
        try:
            data = bytes.fromhex(payload_hex)
        except ValueError:
            return 0.0

        if len(data) == 0:
            return 0.0

        # Считаем частоту каждого байта (от 0 до 255)
        entropy = 0.0
        for x in range(256):
            p_x = data.count(x) / len(data)
            if p_x > 0:
                entropy += - p_x * math.log2(p_x)
                
        return entropy

    @staticmethod
    def diff_payloads(hex_a: str, hex_b: str) -> dict:
        """
        Сравнивает два HEX-сообщения и находит отличия.
        """
        len_a = len(hex_a)
        len_b = len(hex_b)
        min_len = min(len_a, len_b)
        
        differences = []
        # Шагаем по 2 символа (1 байт)
        for i in range(0, min_len, 2):
            byte_a = hex_a[i:i+2]
            byte_b = hex_b[i:i+2]
            if byte_a != byte_b:
                differences.append({
                    "offset": i // 2,
                    "byte_a": byte_a,
                    "byte_b": byte_b
                })
                
        return {
            "is_identical": len_a == len_b and len(differences) == 0,
            "length_difference": abs(len_a - len_b) // 2,
            "differing_bytes": differences
        }
    # База популярных Magic Bytes (сигнатур файлов и протоколов)
    MAGIC_BYTES = {
        "HTTP Request": b"GET ",
        "HTTP Request (POST)": b"POST",
        "HTTP Response": b"HTTP/1.",
        "GZIP Archive": bytes.fromhex("1f8b"),
        "PNG Image": bytes.fromhex("89504e47"),
        "JSON Data": b'{"',
        "TLS/SSL Client Hello": bytes.fromhex("160301") 
    }

    @staticmethod
    def detect_signatures(payload_hex: str) -> list[str]:
        """
        Ищет известные заголовки (Magic Bytes) в начале пакета.
        Помогает аналитику быстро понять, что внутри.
        """
        if not payload_hex:
            return []
            
        try:
            data = bytes.fromhex(payload_hex)
        except ValueError:
            return []

        detected = []
        for name, signature in InfoSecAnalyzer.MAGIC_BYTES.items():
            # Проверяем, начинается ли пакет с этой сигнатуры
            if data.startswith(signature):
                detected.append(name)
                
        return detected