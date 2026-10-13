import struct

class RuleEngine:
    @staticmethod
    def parse_bytes(payload_hex: str, offset: int, length: int, data_type: str, endianness: str = "big") -> dict:
        hex_offset = offset * 2
        hex_length = length * 2

        if hex_offset + hex_length > len(payload_hex):
            return {"success": False, "error": "Выход за границы payload", "value": None}

        target_hex = payload_hex[hex_offset : hex_offset + hex_length]
        
        try:
            target_bytes = bytes.fromhex(target_hex)
        except ValueError:
            return {"success": False, "error": "Некорректные HEX-данные", "value": None}

        prefix = ">" if endianness == "big" else "<"
        value = None
        
        try:
            if data_type == "uint8" and length == 1: value = struct.unpack(f"{prefix}B", target_bytes)[0]
            elif data_type == "uint16" and length == 2: value = struct.unpack(f"{prefix}H", target_bytes)[0]
            elif data_type == "uint32" and length == 4: value = struct.unpack(f"{prefix}I", target_bytes)[0]
            elif data_type == "int8" and length == 1: value = struct.unpack(f"{prefix}b", target_bytes)[0]
            elif data_type == "int16" and length == 2: value = struct.unpack(f"{prefix}h", target_bytes)[0]
            elif data_type == "int32" and length == 4: value = struct.unpack(f"{prefix}i", target_bytes)[0]
            elif data_type == "float32" and length == 4: value = struct.unpack(f"{prefix}f", target_bytes)[0]
            elif data_type == "string": value = target_bytes.decode('utf-8', errors='replace').strip('\x00')
            else: return {"success": False, "error": f"Несовпадение типа {data_type} и длины {length}", "value": target_hex}
        except struct.error:
            return {"success": False, "error": "Ошибка распаковки байтов (struct error)", "value": target_hex}

        return {"success": True, "error": None, "value": value, "raw_hex": target_hex}