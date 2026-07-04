"""RythuMitra Smart Precision Farming backend."""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, List, Optional

import jwt
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

# ------------------------------------------------------------------
# Environment & bootstrap
# ------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

JWT_ALGO = "HS256"
JWT_TTL_HOURS = 24 * 30  # 30 days

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="RythuMitra API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("rythumitra")


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(pw, hashed)
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(now_utc().timestamp()),
        "exp": int((now_utc() + timedelta(hours=JWT_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if cred is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ------------------------------------------------------------------
# Models
# ------------------------------------------------------------------
class RegisterRequest(BaseModel):
    full_name: str
    mobile: str
    password: str
    email: Optional[str] = None
    preferred_language: str = "en"


class LoginRequest(BaseModel):
    mobile: str
    password: str


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    preferred_language: Optional[str] = None


class FieldCreate(BaseModel):
    name: str
    farm_name: Optional[str] = None
    area_acres: float
    soil_type: str
    preferred_crop: str


class AdviceRequest(BaseModel):
    field_id: str
    recommendation_type: str = "fertilizer"  # fertilizer | crop | irrigation
    model: str = "claude"  # claude | rule


class TaskCompleteRequest(BaseModel):
    task_id: str


# ------------------------------------------------------------------
# Seed helpers
# ------------------------------------------------------------------
DEFAULT_TIMELINE = [
    {"day": 1, "title": "Purchase Seeds", "desc": "Buy certified wheat seeds from authorized dealer.", "icon": "cart"},
    {"day": 3, "title": "Seed Treatment", "desc": "Treat seeds with fungicide to prevent early disease.", "icon": "flask"},
    {"day": 7, "title": "Land Preparation", "desc": "Plough and level field, add basal compost.", "icon": "leaf"},
    {"day": 12, "title": "Sowing", "desc": "Sow seeds at 4-5 cm depth with 20 cm row spacing.", "icon": "seedling"},
    {"day": 25, "title": "First Irrigation", "desc": "Irrigate lightly during crown root initiation stage.", "icon": "water"},
    {"day": 35, "title": "First Fertilizer Application", "desc": "Apply DAP at 75 kg/hectare. Broadcast evenly and lightly irrigate after application.", "icon": "cube"},
    {"day": 55, "title": "Second Fertilizer Application", "desc": "Apply Urea top-dressing at tillering stage.", "icon": "cube"},
    {"day": 70, "title": "Weed Management", "desc": "Manual or chemical weeding as required.", "icon": "cut"},
    {"day": 85, "title": "Pest Monitoring", "desc": "Scout for aphids and rust; apply approved pesticides if needed.", "icon": "bug"},
    {"day": 105, "title": "Final Irrigation", "desc": "Provide last irrigation at grain-filling stage.", "icon": "water"},
    {"day": 118, "title": "Pre-harvest Check", "desc": "Inspect grain moisture and readiness.", "icon": "search"},
    {"day": 120, "title": "Harvest", "desc": "Harvest crop and prepare for threshing/storage.", "icon": "trophy"},
]


async def seed_defaults_for_user(user_id: str, farm_name: str) -> None:
    field_id = new_id()
    now = now_utc()
    await db.fields.insert_one({
        "id": field_id,
        "user_id": user_id,
        "name": "North Field",
        "farm_name": farm_name,
        "area_acres": 2.5,
        "soil_type": "Loamy",
        "preferred_crop": "Wheat",
        "created_at": now.isoformat(),
    })
    await db.fields.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "name": "South Field",
        "farm_name": farm_name,
        "area_acres": 3.0,
        "soil_type": "Clay",
        "preferred_crop": "Rice",
        "created_at": now.isoformat(),
    })
    await db.fields.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "name": "East Field",
        "farm_name": farm_name,
        "area_acres": 2.0,
        "soil_type": "Sandy Loam",
        "preferred_crop": "Cotton",
        "created_at": now.isoformat(),
    })

    device_id = new_id()
    await db.devices.insert_one({
        "id": device_id,
        "user_id": user_id,
        "field_id": field_id,
        "serial": f"AGS-2024-BT-{random.randint(1000, 9999)}",
        "connected": False,
        "battery": 78,
        "status": "idle",
        "last_sync": now.isoformat(),
    })

    # Seed planner cycle - crop started 35 days ago
    cycle_start = now - timedelta(days=35)
    cycle_id = new_id()
    await db.cycles.insert_one({
        "id": cycle_id,
        "user_id": user_id,
        "field_id": field_id,
        "crop": "Wheat",
        "season": "Rabi 2024-25",
        "duration_days": 120,
        "started_at": cycle_start.isoformat(),
        "reminders_enabled": True,
    })
    for t in DEFAULT_TIMELINE:
        day = t["day"]
        completed = day < 35
        await db.tasks.insert_one({
            "id": new_id(),
            "user_id": user_id,
            "cycle_id": cycle_id,
            "day": day,
            "title": t["title"],
            "description": t["desc"],
            "icon": t["icon"],
            "completed": completed,
            "completed_at": (cycle_start + timedelta(days=day)).isoformat() if completed else None,
        })


# ------------------------------------------------------------------
# Auth endpoints
# ------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "RythuMitra", "status": "ok"}


@api.post("/auth/register")
async def register(body: RegisterRequest):
    mobile = body.mobile.strip()
    if not mobile or len(body.password) < 4:
        raise HTTPException(400, "Invalid mobile or password")
    existing = await db.users.find_one({"mobile": mobile})
    if existing:
        raise HTTPException(409, "Mobile already registered")

    uid = new_id()
    farm_name = f"{body.full_name.split()[0]}'s Farm" if body.full_name else "My Farm"
    doc = {
        "id": uid,
        "full_name": body.full_name.strip(),
        "mobile": mobile,
        "email": body.email or "",
        "farm_name": farm_name,
        "preferred_language": body.preferred_language or "en",
        "password_hash": hash_password(body.password),
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    await seed_defaults_for_user(uid, farm_name)

    token = make_token(uid)
    user_view = {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
    return {"token": token, "user": user_view}


@api.post("/auth/login")
async def login(body: LoginRequest):
    user = await db.users.find_one({"mobile": body.mobile.strip()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid mobile or password")
    token = make_token(user["id"])
    user_view = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return {"token": token, "user": user_view}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return {"user": user}


@api.patch("/auth/me")
async def update_me(body: UpdateProfileRequest, user=Depends(current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {"user": updated}


# ------------------------------------------------------------------
# Fields & devices
# ------------------------------------------------------------------
@api.get("/fields")
async def list_fields(user=Depends(current_user)):
    items = await db.fields.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return {"fields": items}


@api.post("/fields")
async def create_field(body: FieldCreate, user=Depends(current_user)):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "name": body.name,
        "farm_name": body.farm_name or "",
        "area_acres": body.area_acres,
        "soil_type": body.soil_type,
        "preferred_crop": body.preferred_crop,
        "created_at": now_utc().isoformat(),
    }
    await db.fields.insert_one(doc)
    return {"field": {k: v for k, v in doc.items() if k != "_id"}}


@api.get("/devices")
async def list_devices(user=Depends(current_user)):
    items = await db.devices.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return {"devices": items}


@api.post("/devices/{device_id}/toggle")
async def toggle_device(device_id: str, user=Depends(current_user)):
    dev = await db.devices.find_one({"id": device_id, "user_id": user["id"]})
    if not dev:
        raise HTTPException(404, "Device not found")
    new_state = not dev.get("connected", False)
    await db.devices.update_one(
        {"id": device_id},
        {"$set": {"connected": new_state, "status": "running" if new_state else "idle", "last_sync": now_utc().isoformat()}},
    )
    dev = await db.devices.find_one({"id": device_id}, {"_id": 0})
    return {"device": dev}


@api.post("/devices/{device_id}/control")
async def control_device(device_id: str, action: str = Form(...), user=Depends(current_user)):
    """action: pause | stop | start | refresh | sync"""
    dev = await db.devices.find_one({"id": device_id, "user_id": user["id"]})
    if not dev:
        raise HTTPException(404, "Device not found")
    updates: dict[str, Any] = {"last_sync": now_utc().isoformat()}
    if action == "pause":
        updates["status"] = "paused"
    elif action == "stop":
        updates["status"] = "stopped"
        updates["connected"] = False
    elif action == "start":
        updates["status"] = "running"
        updates["connected"] = True
    elif action in ("refresh", "sync"):
        updates["status"] = "running" if dev.get("connected") else "idle"
    await db.devices.update_one({"id": device_id}, {"$set": updates})
    dev = await db.devices.find_one({"id": device_id}, {"_id": 0})
    return {"device": dev}


# ------------------------------------------------------------------
# Simulated live sensor data
# ------------------------------------------------------------------
def _seed_for(field_id: str, bucket: int) -> random.Random:
    h = hashlib.md5(f"{field_id}:{bucket}".encode()).hexdigest()
    return random.Random(int(h[:12], 16))


def _status_for(value: float, low: float, high: float) -> str:
    if value < low:
        return "Low"
    if value > high:
        return "High"
    return "Good"


def sensor_snapshot(field_id: str) -> dict:
    """Deterministic + drifting live values that update every ~4s."""
    bucket = int(datetime.now(timezone.utc).timestamp() // 4)
    r = _seed_for(field_id, bucket)
    nitrogen = round(r.uniform(60, 260), 0)
    phosphorus = round(r.uniform(35, 160), 0)
    potassium = round(r.uniform(70, 220), 0)
    moisture = round(r.uniform(40, 78), 1)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "nitrogen": {"value": nitrogen, "unit": "mg/kg", "status": _status_for(nitrogen, 80, 220)},
        "phosphorus": {"value": phosphorus, "unit": "mg/kg", "status": _status_for(phosphorus, 50, 140)},
        "potassium": {"value": potassium, "unit": "mg/kg", "status": _status_for(potassium, 100, 200)},
        "moisture": {"value": moisture, "unit": "%", "status": _status_for(moisture, 45, 70)},
    }


@api.get("/sensors/live")
async def live_sensors(field_id: str, user=Depends(current_user)):
    field = await db.fields.find_one({"id": field_id, "user_id": user["id"]}, {"_id": 0})
    if not field:
        raise HTTPException(404, "Field not found")
    snap = sensor_snapshot(field_id)
    # persist snapshot for history (fire-and-forget)
    await db.sensor_readings.insert_one({**snap, "id": new_id(), "field_id": field_id, "user_id": user["id"]})
    alerts = []
    m = snap["moisture"]
    if m["status"] == "High":
        alerts.append({"level": "warning", "title": f"Moisture Alert — {field['name']}", "message": "Soil moisture is above optimal range. Consider pausing irrigation."})
    if snap["phosphorus"]["status"] == "Low":
        alerts.append({"level": "warning", "title": f"Phosphorus Low — {field['name']}", "message": "Phosphorus reading is below optimal. Apply DAP soon."})
    return {"field": field, "readings": snap, "alerts": alerts}


# ------------------------------------------------------------------
# AI Advice
# ------------------------------------------------------------------
def rule_based_advice(readings: dict, crop: str) -> dict:
    n = readings["nitrogen"]["value"]
    p = readings["phosphorus"]["value"]
    k = readings["potassium"]["value"]
    m = readings["moisture"]["value"]

    recs: list[dict] = []
    if p < 50:
        recs.append({"title": "Apply DAP (Di-Ammonium Phosphate)", "detail": "Broadcast 75 kg/hectare across the field. Follow with light irrigation to help absorption.", "priority": "high"})
    if n < 80:
        recs.append({"title": "Apply Urea Top-Dressing", "detail": "Apply 40 kg/hectare of Urea during tillering. Split into 2 doses 15 days apart.", "priority": "medium"})
    if k < 100:
        recs.append({"title": "Apply MOP (Muriate of Potash)", "detail": "Apply 30 kg/hectare to improve grain quality and disease resistance.", "priority": "medium"})
    if m > 70:
        recs.append({"title": "Pause Irrigation", "detail": "Soil moisture is above optimal. Skip next irrigation cycle to avoid root diseases.", "priority": "high"})
    elif m < 45:
        recs.append({"title": "Irrigate Immediately", "detail": "Soil moisture is critically low. Provide 40 mm irrigation within 24 hours.", "priority": "high"})
    if not recs:
        recs.append({"title": "Maintain Current Regimen", "detail": f"Soil parameters are optimal for {crop}. Continue current fertilization schedule.", "priority": "low"})

    summary = f"Soil is broadly {'stressed' if len(recs) > 2 else 'balanced'} for {crop}."
    return {"summary": summary, "recommendations": recs}


async def claude_advice(readings: dict, crop: str, field_name: str, req_type: str) -> dict:
    """Call Claude Sonnet 4.5 via emergent LLM key. Fallback to rule-based on failure."""
    if not EMERGENT_LLM_KEY:
        return rule_based_advice(readings, crop)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        system_prompt = (
            "You are RythuMitra, an expert agricultural advisor helping Indian farmers. "
            "Given real-time soil sensor readings, produce concise, actionable recommendations. "
            "Respond ONLY with valid JSON matching: "
            '{"summary": "one-line status", "recommendations": [{"title": "...", "detail": "...", "priority": "high|medium|low"}]}. '
            "Use metric units. Keep detail under 200 characters. No markdown."
        )
        prompt = (
            f"Field: {field_name}\nCrop: {crop}\nRequest type: {req_type}\n"
            f"Sensor readings:\n"
            f"- Nitrogen: {readings['nitrogen']['value']} {readings['nitrogen']['unit']} ({readings['nitrogen']['status']})\n"
            f"- Phosphorus: {readings['phosphorus']['value']} {readings['phosphorus']['unit']} ({readings['phosphorus']['status']})\n"
            f"- Potassium: {readings['potassium']['value']} {readings['potassium']['unit']} ({readings['potassium']['status']})\n"
            f"- Moisture: {readings['moisture']['value']} {readings['moisture']['unit']} ({readings['moisture']['status']})\n"
            f"Give 3-5 recommendations."
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"advice-{new_id()}",
            system_message=system_prompt,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        text = await chat.send_message(UserMessage(text=prompt))
        # try to parse JSON
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        data = json.loads(cleaned)
        if "recommendations" in data and isinstance(data["recommendations"], list):
            return {"summary": data.get("summary", ""), "recommendations": data["recommendations"]}
    except Exception as e:  # noqa: BLE001
        log.warning("Claude advice failed, falling back to rules: %s", e)
    return rule_based_advice(readings, crop)


@api.post("/advice/generate")
async def generate_advice(body: AdviceRequest, user=Depends(current_user)):
    field = await db.fields.find_one({"id": body.field_id, "user_id": user["id"]}, {"_id": 0})
    if not field:
        raise HTTPException(404, "Field not found")
    readings = sensor_snapshot(body.field_id)
    if body.model == "claude":
        advice = await claude_advice(readings, field["preferred_crop"], field["name"], body.recommendation_type)
    else:
        advice = rule_based_advice(readings, field["preferred_crop"])

    warning = None
    if readings["phosphorus"]["status"] == "Low":
        warning = "Phosphorus is critically low. Immediate fertilization recommended before next irrigation cycle."
    elif readings["moisture"]["status"] == "High":
        warning = "Soil moisture is above optimal range. Consider pausing irrigation."

    result = {
        "field": field,
        "readings": readings,
        "warning": warning,
        "summary": advice["summary"],
        "recommendations": advice["recommendations"],
        "model_used": body.model,
        "generated_at": now_utc().isoformat(),
    }
    await db.advice_history.insert_one({**result, "id": new_id(), "user_id": user["id"]})
    return result


# ------------------------------------------------------------------
# Planner
# ------------------------------------------------------------------
@api.get("/planner")
async def get_planner(user=Depends(current_user)):
    cycle = await db.cycles.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cycle:
        return {"cycle": None, "tasks": []}
    field = await db.fields.find_one({"id": cycle["field_id"]}, {"_id": 0})
    tasks = await db.tasks.find({"cycle_id": cycle["id"]}, {"_id": 0}).sort("day", 1).to_list(500)
    started = datetime.fromisoformat(cycle["started_at"])
    today_day = min(cycle["duration_days"], max(1, (now_utc() - started).days + 1))
    completed_count = sum(1 for t in tasks if t.get("completed"))
    progress = round(100 * completed_count / max(1, len(tasks)))
    today_task = next((t for t in tasks if t["day"] == today_day and not t["completed"]), None)
    if today_task is None:
        today_task = next((t for t in tasks if not t["completed"]), None)
    return {
        "cycle": {**cycle, "field_name": field["name"] if field else "", "today_day": today_day, "progress": progress},
        "tasks": tasks,
        "today_task": today_task,
    }


@api.post("/planner/complete")
async def complete_task(body: TaskCompleteRequest, user=Depends(current_user)):
    task = await db.tasks.find_one({"id": body.task_id, "user_id": user["id"]})
    if not task:
        raise HTTPException(404, "Task not found")
    await db.tasks.update_one({"id": body.task_id}, {"$set": {"completed": True, "completed_at": now_utc().isoformat()}})
    return {"ok": True}


@api.post("/planner/reminders")
async def toggle_reminders(enabled: bool = Form(...), user=Depends(current_user)):
    await db.cycles.update_one({"user_id": user["id"]}, {"$set": {"reminders_enabled": enabled}})
    return {"enabled": enabled}


# ------------------------------------------------------------------
# Voice / Whisper
# ------------------------------------------------------------------
@api.post("/voice/transcribe")
async def voice_transcribe(audio: UploadFile = File(...), user=Depends(current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM key not configured")
    try:
        from openai import OpenAI

        data = await audio.read()
        buf = io.BytesIO(data)
        buf.name = audio.filename or "audio.m4a"
        oai = OpenAI(api_key=EMERGENT_LLM_KEY, base_url="https://integrations.emergentagent.com/llm")
        # Try emergent gateway; fall back to Whisper via direct openai package if available
        try:
            resp = oai.audio.transcriptions.create(model="whisper-1", file=buf)
            text = resp.text if hasattr(resp, "text") else str(resp)
        except Exception:
            buf.seek(0)
            oai2 = OpenAI(api_key=EMERGENT_LLM_KEY)
            resp = oai2.audio.transcriptions.create(model="whisper-1", file=buf)
            text = resp.text if hasattr(resp, "text") else str(resp)
        return {"text": text}
    except Exception as e:
        log.exception("Transcription failed")
        raise HTTPException(500, f"Transcription failed: {e}")


# ------------------------------------------------------------------
# App wiring
# ------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
