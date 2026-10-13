from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import shutil
import os
import uuid
import json
from starlette.concurrency import run_in_threadpool

from services.parser import PcapParser
from services.rule_engine import RuleEngine
from services.exporter import ParserGenerator
from services.infosec import InfoSecAnalyzer

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# --- Модели ---
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


class ValidateCorpusRequest(BaseModel):
    rules: list[RuleDef]
    direction_filter: str = "all"


class DiffRequest(BaseModel):
    payload_a: str
    payload_b: str


def _get_file_path(project_id: str) -> str:
    pcap = os.path.join(UPLOAD_DIR, f"{project_id}.pcap")
    pcapng = os.path.join(UPLOAD_DIR, f"{project_id}.pcapng")
    if os.path.exists(pcap):
        return pcap
    if os.path.exists(pcapng):
        return pcapng
    raise HTTPException(status_code=404, detail="Проект или файл не найден")


# --- R1, R2: загрузка и сессии ---
@router.post("/project/upload")
async def upload_pcap(file: UploadFile = File(...)):
    """Сохраняет файл и возвращает ID проекта."""
    if not file.filename.endswith(('.pcap', '.pcapng')):
        raise HTTPException(status_code=400, detail="Формат файла должен быть .pcap или .pcapng")
    project_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    path = os.path.join(UPLOAD_DIR, f"{project_id}{ext}")
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"project_id": project_id, "filename": file.filename}


@router.get("/project/{project_id}/sessions")
async def get_sessions(project_id: str):
    target = _get_file_path(project_id)
    try:
        sessions_dict = await run_in_threadpool(PcapParser.extract_tcp_sessions, target)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    sessions_list = [
        {"id": s["id"], "endpoints": s["endpoints"], "packet_count": len(s["packets"])}
        for s in sessions_dict.values()
    ]
    return {"sessions": sessions_list}


@router.get("/project/{project_id}/sessions/{session_id}/packets")
async def get_session_packets(project_id: str, session_id: str):
    target = _get_file_path(project_id)
    try:
        sessions_dict = await run_in_threadpool(PcapParser.extract_tcp_sessions, target)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if session_id not in sessions_dict:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    return {"packets": sessions_dict[session_id]["packets"]}


# --- R3: apply ---
@router.post("/project/apply_rules")
async def apply_rules(request: RuleApplyRequest):
    """Прогоняет payloads через правила. Stateless, без project_id."""
    results = []
    for payload in request.payloads:
        packet_result = {"payload": payload, "matches": []}
        for rule in request.rules:
            match = RuleEngine.parse_bytes(
                payload_hex=payload,
                offset=rule.offset,
                length=rule.length,
                data_type=rule.data_type,
                endianness=rule.endianness,
            )
            packet_result["matches"].append({
                "rule_id": rule.id,
                "rule_name": rule.name,
                "success": match["success"],
                "value": match["value"],
                "error": match["error"],
            })
        results.append(packet_result)
    return {"status": "success", "results": results}


# --- R5: state ---
@router.post("/project/{project_id}/state")
async def save_project_state(project_id: str, state: ProjectState):
    state_file = os.path.join(UPLOAD_DIR, f"{project_id}_state.json")
    try:
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state.model_dump(), f, indent=4, ensure_ascii=False)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/project/{project_id}/state")
async def load_project_state(project_id: str):
    state_file = os.path.join(UPLOAD_DIR, f"{project_id}_state.json")
    if not os.path.exists(state_file):
        return {"rules": [], "notes": ""}
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- R6: export ---
@router.post("/project/export_parser")
async def export_parser(request: ExportRequest):
    try:
        rules_dict = [r.model_dump() for r in request.rules]
        script = ParserGenerator.generate_python_script(rules_dict)
        return {"status": "success", "script": script}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- R4: validate ---
@router.post("/project/{project_id}/sessions/{session_id}/validate_rules")
async def validate_corpus_rules(project_id: str, session_id: str, request: ValidateCorpusRequest):
    target = _get_file_path(project_id)
    try:
        sessions_dict = await run_in_threadpool(PcapParser.extract_tcp_sessions, target)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if session_id not in sessions_dict:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    all_packets = sessions_dict[session_id]["packets"]
    if request.direction_filter != "all":
        target_packets = [p for p in all_packets if p["direction"] == request.direction_filter]
    else:
        target_packets = all_packets

    report = {
        "total_packets_checked": len(target_packets),
        "successful_packets": 0,
        "failed_packets": 0,
        "results": [],
    }
    for packet in target_packets:
        ok = True
        errors = []
        values = {}
        for rule in request.rules:
            m = RuleEngine.parse_bytes(
                payload_hex=packet["payload_hex"],
                offset=rule.offset,
                length=rule.length,
                data_type=rule.data_type,
                endianness=rule.endianness,
            )
            if m["success"]:
                values[rule.name] = m["value"]
            else:
                ok = False
                errors.append(f"Правило '{rule.name}': {m['error']}")
        if ok:
            report["successful_packets"] += 1
        else:
            report["failed_packets"] += 1
        report["results"].append({
            "packet_id": packet["id"],
            "timestamp": packet["timestamp"],
            "payload_hex": packet["payload_hex"],
            "anomaly": packet.get("anomaly"),
            "is_valid": ok,
            "parsed_values": values if ok else None,
            "errors": errors if not ok else None,
        })
    return report


# --- Infosec ---
@router.get("/infosec/signatures")
async def get_signatures(payload_hex: str):
    return {"signatures": InfoSecAnalyzer.detect_signatures(payload_hex)}


@router.get("/infosec/entropy")
async def get_entropy(payload_hex: str):
    entropy = InfoSecAnalyzer.calculate_entropy(payload_hex)
    return {"entropy": round(entropy, 2), "is_encrypted": entropy > 7.5}


@router.post("/infosec/diff")
async def get_diff(request: DiffRequest):
    return InfoSecAnalyzer.diff_payloads(request.payload_a, request.payload_b)