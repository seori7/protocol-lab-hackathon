from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import shutil
import os
import uuid
from services.parser import PcapParser
from starlette.concurrency import run_in_threadpool
from services.rule_engine import RuleEngine

router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- МОДЕЛИ И ЭНДПОИНТ ДЛЯ ПРАВИЛ ---

class RuleDef(BaseModel):
    id: str
    name: str
    offset: int
    length: int
    data_type: str
    endianness: str = "big"

class RuleApplyRequest(BaseModel):
    rules: list[RuleDef]
    payloads: list[str] # Массив hex-строк пакетов, которые мы хотим проверить

@router.post("/project/apply_rules")
async def apply_rules(request: RuleApplyRequest):
    """
    Универсальный эндпоинт. Берет массив пакетов и прогоняет их через массив правил.
    Возвращает расшифрованные значения или ошибки (контрпримеры).
    """
    results = []

    for payload in request.payloads:
        packet_result = {"payload": payload, "matches": []}
        
        for rule in request.rules:
            # Отправляем данные в наш Движок Интерпретаций
            match = RuleEngine.parse_bytes(
                payload_hex=payload,
                offset=rule.offset,
                length=rule.length,
                data_type=rule.data_type,
                endianness=rule.endianness
            )
            
            packet_result["matches"].append({
                "rule_id": rule.id,
                "rule_name": rule.name,
                "success": match["success"],
                "value": match["value"],
                "error": match["error"]
            })
            
        results.append(packet_result)

    return {"status": "success", "results": results}