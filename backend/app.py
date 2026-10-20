from fastapi import FastAPI
from pydantic import BaseModel
import heapq
import time

app = FastAPI(title="SafeQ ER")

# 1. Definim ce date trimite asistenta din frontend
class TriageRequest(BaseModel):
    spo2: int
    tensiune: int
    durere_toracica: bool

# 2. Definim cum arată un pacient în sistemul nostru
class Patient:
    def __init__(self, token, scor_baza):
        self.token = token
        self.scor_baza = scor_baza
        self.timp_sosire = time.time()

    # Calculăm prioritatea dinamică (scor inițial + timp așteptare)
    def prioritate_curenta(self):
        minute_asteptare = (time.time() - self.timp_sosire) / 60
        return self.scor_baza + (minute_asteptare * 0.5)

    # Secretul Max-Heap-ului: elementul cu scor mai MARE are prioritate
    def __lt__(self, other):
        return self.prioritate_curenta() > other.prioritate_curenta()

# Lista care va funcționa ca un Max-Heap
coada_triaj = []
numar_token = 101

# 3. Ruta prin care adăugăm pacienți noi în coadă
@app.post("/adauga-pacient")
def adauga_pacient(date: TriageRequest):
    global numar_token
    
    # Calculăm scorul (simplificat)
    scor = 20 # Cod Verde implicit
    if date.durere_toracica or date.spo2 < 90:
        scor = 100 # Cod Roșu
    elif date.spo2 < 95 or date.tensiune > 160:
        scor = 50 # Cod Galben

    # Generăm jetonul anonim
    token = f"#A-{numar_token}"
    numar_token += 1
    
    # Adăugăm în Max-Heap
    pacient_nou = Patient(token, scor)
    heapq.heappush(coada_triaj, pacient_nou)
    
    return {"mesaj": "Pacient adăugat cu succes!", "token": token, "scor_atribuit": scor}



# 4. Ruta pentru a vedea panoul din sala de așteptare
@app.get("/coada-pacienti")
def vezi_coada():
    # Sortăm pacienții descrescător după prioritatea lor curentă
    pacienti_ordonati = sorted(coada_triaj, key=lambda p: p.prioritate_curenta(), reverse=True)
    
    rezultat = []
    for p in pacienti_ordonati:
        rezultat.append({
            "token": p.token,
            "scor_curent": round(p.prioritate_curenta(), 1)
        })
        
    return {"in_asteptare": rezultat}