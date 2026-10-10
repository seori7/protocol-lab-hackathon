from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import shutil
import os
import uuid
from services.parser import PcapParser

# НОВЫЙ ИМПОРТ:
from starlette.concurrency import run_in_threadpool

router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class RuleApplyRequest(BaseModel):
    rules: list

@router.post("/project/upload")
async def upload_pcap(file: UploadFile = File(...)):
    if not file.filename.endswith(('.pcap', '.pcapng')):
        raise HTTPException(status_code=400, detail="Формат файла должен быть .pcap или .pcapng")

    project_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1]
    safe_filename = f"{project_id}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"project_id": project_id, "filename": file.filename}


@router.get("/project/{project_id}/packets")
async def get_packets(project_id: str):
    file_path_pcap = os.path.join(UPLOAD_DIR, f"{project_id}.pcap")
    file_path_pcapng = os.path.join(UPLOAD_DIR, f"{project_id}.pcapng")
    
    target_file = None
    if os.path.exists(file_path_pcap):
        target_file = file_path_pcap
    elif os.path.exists(file_path_pcapng):
        target_file = file_path_pcapng
        
    if not target_file:
        raise HTTPException(status_code=404, detail="Проект или файл не найден")

    try:
        # АРХИТЕКТУРНЫЙ ФИКС:
        # Запускаем pyshark в отдельном потоке (Thread), чтобы он не ломал event loop FastAPI
        packets = await run_in_threadpool(PcapParser.extract_tcp_streams, target_file)
        return {"packets": packets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка парсинга: {str(e)}")


@router.post("/project/{project_id}/apply_rules")
async def apply_rules(project_id: str, request: RuleApplyRequest):
    return {"status": "success", "matched_packets": len(request.rules)}