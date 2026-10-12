from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import shutil
import os
import uuid
import json
from starlette.concurrency import run_in_threadpool

# Импорты наших сервисов
from services.parser import PcapParser
from services.rule_engine import RuleEngine
from services.exporter import ParserGenerator
from services.infosec import InfoSecAnalyzer

router = APIRouter()

# Папка для сохранения файлов
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ==========================================
# PYDANTIC МОДЕЛИ (Описывают структуру JSON)
# ==========================================
class RuleDef(BaseModel):
    id: str
    name: str
    offset: int
    length: int
    data_type: str
    endianness: str = "big"

class RuleApplyRequest(BaseModel):
    rules: list[RuleDef]
    payloads: list[str]

class ProjectState(BaseModel):
    rules: list[RuleDef]
    notes: str = ""

class ExportRequest(BaseModel):
    rules: list[RuleDef]

# ==========================================
# ЭНДПОИНТЫ ЗАГРУЗКИ И ПАРСИНГА (R1, R2)
# ==========================================
@router.post("/project/upload")
async def upload_pcap(file: UploadFile = File(...)):
    """Сохраняет загруженный файл и возвращает ID проекта."""
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
    """Возвращает список TCP-сессий (без самих пакетов)."""
    target_file = _get_file_path(project_id)
    try:
        sessions_dict = await run_in_threadpool(PcapParser.extract_tcp_sessions, target_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    sessions_list = [
        {"id": s["id"], "endpoints": s["endpoints"], "packet_count": len(s["packets"])} 
        for s in sessions_dict.values()
    ]
    return {"sessions": sessions_list}

@router.get("/project/{project_id}/sessions/{session_id}/packets")
async def get_session_packets(project_id: str, session_id: str):
    """Возвращает отсортированные пакеты конкретной сессии."""
    target_file = _get_file_path(project_id)
    try:
        sessions_dict = await run_in_threadpool(PcapParser.extract_tcp_sessions, target_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    if session_id not in sessions_dict:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
        
    return {"packets": sessions_dict[session_id]["packets"]}

# ==========================================
# ЭНДПОИНТЫ БИЗНЕС-ЛОГИКИ (R3, R5, R6)
# ==========================================
@router.post("/project/apply_rules")
async def apply_rules(request: RuleApplyRequest):
    """(R3) Прогоняет массив пакетов через массив правил."""
    results = []
    for payload in request.payloads:
        packet_result = {"payload": payload, "matches": []}
        for rule in request.rules:
            match = RuleEngine.parse_bytes(
                payload_hex=payload, offset=rule.offset, length=rule.length,
                data_type=rule.data_type, endianness=rule.endianness
            )
            packet_result["matches"].append({
                "rule_id": rule.id, "rule_name": rule.name,
                "success": match["success"], "value": match["value"], "error": match["error"]
            })
        results.append(packet_result)
    return {"status": "success", "results": results}

@router.post("/project/{project_id}/state")
async def save_project_state(project_id: str, state: ProjectState):
    """(R5) Сохраняет проект (правила) в JSON."""
    state_file = os.path.join(UPLOAD_DIR, f"{project_id}_state.json")
    try:
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state.model_dump(), f, indent=4, ensure_ascii=False)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project/{project_id}/state")
async def load_project_state(project_id: str):
    """(R5) Загружает проект из JSON."""
    state_file = os.path.join(UPLOAD_DIR, f"{project_id}_state.json")
    if not os.path.exists(state_file):
        return {"rules": [], "notes": ""}
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/project/export_parser")
async def export_parser(request: ExportRequest):
    """(R6) Генерирует Python-скрипт по правилам."""
    try:
        rules_dict = [rule.model_dump() for rule in request.rules]
        script_code = ParserGenerator.generate_python_script(rules_dict)
        return {"status": "success", "script": script_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/infosec/signatures")
async def get_signatures(payload_hex: str):
    """Определяет тип данных по первым байтам."""
    detected = InfoSecAnalyzer.detect_signatures(payload_hex)
    return {"signatures": detected}

# ==========================================
# УТИЛИТЫ
# ==========================================
def _get_file_path(project_id: str) -> str:
    file_path_pcap = os.path.join(UPLOAD_DIR, f"{project_id}.pcap")
    file_path_pcapng = os.path.join(UPLOAD_DIR, f"{project_id}.pcapng")
    if os.path.exists(file_path_pcap): return file_path_pcap
    if os.path.exists(file_path_pcapng): return file_path_pcapng
    raise HTTPException(status_code=404, detail="Проект или файл не найден")

# --- ВАЛИДАЦИЯ КОРПУСА (Требование R4) ---

class ValidateCorpusRequest(BaseModel):
    rules: list[RuleDef]
    direction_filter: str = "all" # 'client_to_server', 'server_to_client' или 'all'

@router.post("/project/{project_id}/sessions/{session_id}/validate_rules")
async def validate_corpus_rules(project_id: str, session_id: str, request: ValidateCorpusRequest):
    """
    Прогоняет переданные правила по всем пакетам сессии.
    Возвращает статистику успешных применений и список контрпримеров (ошибок).
    """
    target_file = _get_file_path(project_id)
    
    try:
        sessions_dict = await run_in_threadpool(PcapParser.extract_tcp_sessions, target_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    if session_id not in sessions_dict:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    all_packets = sessions_dict[session_id]["packets"]
    
    # Фильтруем пакеты по направлению (например, правило предназначено только для ответов сервера)
    if request.direction_filter != "all":
        target_packets = [p for p in all_packets if p["direction"] == request.direction_filter]
    else:
        target_packets = all_packets

    report = {
        "total_packets_checked": len(target_packets),
        "successful_packets": 0,
        "failed_packets": 0,
        "results": [] # Детальный отчет по каждому пакету
    }

    for packet in target_packets:
        packet_success = True
        packet_errors = []
        parsed_values = {}

        for rule in request.rules:
            match = RuleEngine.parse_bytes(
                payload_hex=packet["payload_hex"],
                offset=rule.offset,
                length=rule.length,
                data_type=rule.data_type,
                endianness=rule.endianness
            )
            
            if match["success"]:
                parsed_values[rule.name] = match["value"]
            else:
                packet_success = False
                packet_errors.append(f"Правило '{rule.name}': {match['error']}")

        if packet_success:
            report["successful_packets"] += 1
        else:
            report["failed_packets"] += 1

        report["results"].append({
            "packet_id": packet["id"],
            "timestamp": packet["timestamp"],
            "payload_hex": packet["payload_hex"],
            "anomaly": packet["anomaly"],
            "is_valid": packet_success,
            "parsed_values": parsed_values if packet_success else None,
            "errors": packet_errors if not packet_success else None
        })

    return report

# --- ИБ-ИНСТРУМЕНТЫ (Расширение ТЗ) ---

class DiffRequest(BaseModel):
    payload_a: str
    payload_b: str

@router.get("/infosec/entropy")
async def get_entropy(payload_hex: str):
    """
    Рассчитывает энтропию полезной нагрузки. 
    > 7.5 - вероятно шифрование или сжатие.
    """
    entropy = InfoSecAnalyzer.calculate_entropy(payload_hex)
    return {
        "entropy": round(entropy, 2),
        "is_encrypted": entropy > 7.5
    }

@router.post("/infosec/diff")
async def get_diff(request: DiffRequest):
    """
    Побайтовое сравнение двух пакетов (Визуальный Diff).
    """
    diff_result = InfoSecAnalyzer.diff_payloads(request.payload_a, request.payload_b)
    return diff_result