class ParserGenerator:
    @staticmethod
    def generate_python_script(rules: list[dict]) -> str:
        lines = [
            '"""\nАвтоматически сгенерированный парсер сетевого протокола.\nЭкспортировано из Protocol Lab.\n"""',
            "import struct\n",
            "def parse_packet(hex_payload: str) -> dict:",
            "    result = {}",
            "    try:",
            "        payload_bytes = bytes.fromhex(hex_payload)",
            "    except ValueError:",
            "        return {'error': 'Некорректная HEX-строка'}\n"
        ]

        fmt_map = {
            "uint8": "B", "uint16": "H", "uint32": "I",
            "int8": "b", "int16": "h", "int32": "i", "float32": "f"
        }

        for r in rules:
            name = r.get("name", "unknown_field")
            offset = r.get("offset", 0)
            length = r.get("length", 0)
            dtype = r.get("data_type", "")
            endian = ">" if r.get("endianness", "big") == "big" else "<"
            
            lines.append(f"    # Правило: {name}")
            lines.append(f"    if len(payload_bytes) >= {offset + length}:")
            lines.append(f"        target = payload_bytes[{offset}:{offset+length}]")
            
            if dtype == "string":
                lines.append(f"        result['{name}'] = target.decode('utf-8', errors='replace').strip('\\x00')")
            elif dtype in fmt_map:
                lines.append(f"        result['{name}'] = struct.unpack('{endian}{fmt_map[dtype]}', target)[0]")
            else:
                lines.append(f"        result['{name}'] = target.hex()")
                
            lines.append(f"    else:")
            lines.append(f"        result['{name}'] = None  # Выход за границы пакета\n")
        
        lines.append("    return result\n")
        lines.append("if __name__ == '__main__':")
        lines.append("    sample_hex = '41A80000'")
        lines.append("    print('Результат парсинга:', parse_packet(sample_hex))")
        
        return "\n".join(lines)