from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import heapq
import time

# Punctul de legătură: importăm graful și alocarea din alocare.py
try:
    from backend.alocare import cauta_camera_optima
except ImportError:
    from alocare import cauta_camera_optima

app = FastAPI(title="SafeQ ER API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Nivelurile conform SAFEQ.LEVELS din frontend
LEVELS_CONFIG = {
    "red":    {"base": 100, "label": "Roșu"},
    "orange": {"base": 80,  "label": "Portocaliu"},
    "yellow": {"base": 50,  "label": "Galben"},
    "green":  {"base": 20,  "label": "Verde"},
    "blue":   {"base": 10,  "label": "Albastru"}
}
WAIT_BONUS_PER_MIN = 0.5

# 1. Clasa Patient concepută de Carla, extinsă cu status și nivel
class Patient:
    def __init__(self, token, level, scor_baza, symptoms="", vitals=None):
        self.token = token
        self.level = level
        self.scor_baza = scor_baza
        self.timp_sosire = time.time()
        self.symptoms = symptoms
        self.vitals = vitals or {}
        self.status = "waiting"
        self.room = None
        self.called_at = None

    def wait_minutes(self):
        return (time.time() - self.timp_sosire) / 60

    def prioritate_curenta(self):
        return self.scor_baza + (self.wait_minutes() * WAIT_BONUS_PER_MIN)

    # Max-Heap determinist: scorul mai mare are prioritate
    def __lt__(self, other):
        return self.prioritate_curenta() > other.prioritate_curenta()

coada_triaj: List[Patient] = []
chemati_istoric: List[Patient] = []
numar_token = 0

# 2. Modelele de intrare Pydantic potrivite cu api.js
class VitalsInput(BaseModel):
    pulse: Optional[float] = None
    systolic: Optional[float] = None
    diastolic: Optional[float] = None
    spo2: Optional[float] = None
    temp: Optional[float] = None

class CreatePatientRequest(BaseModel):
    vitals: VitalsInput
    symptoms: Optional[str] = ""
    red_flags: List[str] = Field(default_factory=list)

class CallNextRequest(BaseModel):
    room: Optional[str] = "Sala 1"

class PriorityOverrideRequest(BaseModel):
    level: str
    justification: str

def calculeaza_nivel(flags: List[str], vitals: VitalsInput) -> str:
    """Regulile Manchester Triage Systems aliniate la frontend"""
    if "not_breathing" in flags or "unconscious" in flags:
        return "red"
    if "chest_pain" in flags or (vitals.spo2 is not None and vitals.spo2 < 90) or \
       (vitals.systolic is not None and vitals.systolic > 180):
        return "orange"
    if "bleeding" in flags or "fracture" in flags:
        return "yellow"
    return "green"

# ==========================================
# RUTELE OFICIALE API PENTRU FRONTEND
# ==========================================

# 1. Adăugare pacient din triage.html
@app.post("/api/patients")
def adauga_pacient_api(date: CreatePatientRequest):
    global numar_token
    numar_token += 1
    token = f"A-{str(numar_token).zfill(3)}"
    
    level = calculeaza_nivel(date.red_flags, date.vitals)
    scor = LEVELS_CONFIG[level]["base"]
    
    pacient_nou = Patient(token, level, scor, date.symptoms or "", date.vitals.dict())
    heapq.heappush(coada_triaj, pacient_nou)
    
    return {"token": token, "level": level, "score": scor}

# 2. Afișare coadă activă pentru dashboard.html
@app.get("/api/queue")
def vezi_coada_api():
    in_asteptare = [p for p in coada_triaj if p.status == "waiting"]
    pacienti_ordonati = sorted(in_asteptare, key=lambda p: p.prioritate_curenta(), reverse=True)
    
    return [
        {
            "token": p.token,
            "level": p.level,
            "score": round(p.prioritate_curenta(), 1),
            "wait_min": int(p.wait_minutes()),
            "symptoms": p.symptoms,
            "room": p.room
        }
        for p in pacienti_ordonati
    ]

# 3. Preluare pacient următor (Max-Heap + BFS din alocare.py)
@app.post("/api/call-next")
def cheama_urmatorul_api(date: CallNextRequest):
    in_asteptare = [p for p in coada_triaj if p.status == "waiting"]
    if not in_asteptare:
        return {"token": None}
    
    heapq.heapify(coada_triaj)
    
    while coada_triaj:
        candidat = heapq.heappop(coada_triaj)
        if candidat.status == "waiting":
            camera_alocata = cauta_camera_optima(candidat.level, date.room)
            candidat.status = "called"
            candidat.room = camera_alocata
            candidat.called_at = time.time()
            
            chemati_istoric.insert(0, candidat)
            return {
                "token": candidat.token,
                "room": candidat.room,
                "level": candidat.level
            }
            
    return {"token": None}

# 4. Modificare manuală / Retriaj din dialogul din dashboard.html
@app.post("/api/patients/{token}/priority")
def retriaj_api(token: str, date: PriorityOverrideRequest):
    if not date.justification.strip():
        raise HTTPException(status_code=400, detail="Justificarea este obligatorie.")
    if date.level not in LEVELS_CONFIG:
        raise HTTPException(status_code=400, detail="Nivel invalid.")

    for p in coada_triaj:
        if p.token == token and p.status == "waiting":
            p.level = date.level
            p.scor_baza = LEVELS_CONFIG[date.level]["base"]
            p.timp_sosire = time.time()  # resetare timp așteptare conform modelului
            heapq.heapify(coada_triaj)
            return {"ok": True}

    raise HTTPException(status_code=404, detail="Pacientul nu a fost găsit în coadă.")

# 5. Lista pacienților chemați pentru avizierul public display.html
@app.get("/api/called")
def vezi_chemati_api():
    return [
        {
            "token": p.token,
            "level": p.level,
            "score": round(p.prioritate_curenta(), 1),
            "wait_min": int(p.wait_minutes()),
            "symptoms": p.symptoms,
            "room": p.room
        }
        for p in chemati_istoric[:4]
    ]
