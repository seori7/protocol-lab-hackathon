from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class Rule(BaseModel):
    offset: int
    length: int
    data_type: str
    name: str

class ApplyRulesRequest(BaseModel):
    rules: List[Rule]

@router.post("/project/upload")
async def upload_project():
    """
    Заглушка для загрузки pcap файла.
    Возвращает ID проекта.
    """
    return {"project_id": "123"}

@router.get("/project/{project_id}/packets")
async def get_packets(project_id: str):
    """
    Возвращает mock-данные — список из минимум 3-х TCP-пакетов.
    """
    return [
        {
            "id": 1,
            "timestamp": 1699020000.123,
            "direction": "client_to_server",
            "payload_hex": "48656c6c6f000102"
        },
        {
            "id": 2,
            "timestamp": 1699020000.145,
            "direction": "server_to_client",
            "payload_hex": "576f726c64000304"
        },
        {
            "id": 3,
            "timestamp": 1699020000.180,
            "direction": "client_to_server",
            "payload_hex": "41636b6e6f776c6564676500"
        },
        {
            "id": 4,
            "timestamp": 1699020000.200,
            "direction": "server_to_client",
            "payload_hex": "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324"
        }
    ]

@router.post("/project/{project_id}/apply_rules")
async def apply_rules(project_id: str, request: ApplyRulesRequest):
    """
    Принимает JSON со списком правил и применяет их.
    """
    return {"status": "success", "matched_packets": 2}
