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


@router.get("/project/{project_id}/sessions")
async def get_sessions(project_id: str):
    """
    Возвращает список всех TCP-сессий в файле.
    """
    target_file = _get_file_path(project_id)
    
    try:
        sessions_dict = await run_in_threadpool(PcapParser.extract_tcp_sessions, target_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # Возвращаем метаданные
    sessions_list = [
        {"id": s["id"], "endpoints": s["endpoints"], "packet_count": len(s["packets"])} 
        for s in sessions_dict.values()
    ]
    return {"sessions": sessions_list}


@router.get("/project/{project_id}/sessions/{session_id}/packets")
async def get_session_packets(project_id: str, session_id: str):
    """
    Возвращает очищенные пакеты для конкретной сессии.
    """
    target_file = _get_file_path(project_id)
    
    try:
        sessions_dict = await run_in_threadpool(PcapParser.extract_tcp_sessions, target_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # Выносим проверку 404 за пределы блока try-except, чтобы она не превращалась в 500
    if session_id not in sessions_dict:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
        
    return {"packets": sessions_dict[session_id]["packets"]}

# Вспомогательная функция, чтобы не дублировать код поиска файла
def _get_file_path(project_id: str) -> str:
    file_path_pcap = os.path.join(UPLOAD_DIR, f"{project_id}.pcap")
    file_path_pcapng = os.path.join(UPLOAD_DIR, f"{project_id}.pcapng")
    
    if os.path.exists(file_path_pcap):
        return file_path_pcap
    if os.path.exists(file_path_pcapng):
        return file_path_pcapng
        
    raise HTTPException(status_code=404, detail="Проект или файл не найден")


@router.post("/project/{project_id}/apply_rules")
async def apply_rules(project_id: str, request: RuleApplyRequest):
    return {"status": "success", "matched_packets": len(request.rules)}