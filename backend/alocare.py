# backend/alocare.py
from collections import deque

# Graful secției UPU: leagă nivelul de triaj de sălile alocate
SPITAL_GRAF = {
    "red": ["Sala 1", "Sala 2"],
    "orange": ["Sala 1", "Sala 2"],
    "yellow": ["Sala 2", "Sala 3"],
    "green": ["Sala 3"],
    "blue": ["Sala 3"]
}

# Starea sălilor: True = Liber, False = Ocupat
STATUS_SALI = {
    "Sala 1": True,
    "Sala 2": True,
    "Sala 3": True
}

def cauta_camera_optima(nivel_prioritate: str, camera_solicitata: str = None) -> str:
    """
    Dacă asistenta a selectat o sală specifică în interfață, o respectă.
    Dacă nu, folosește BFS pe graful spitalului pentru a găsi prima sală liberă compatibilă.
    """
    if camera_solicitata and camera_solicitata in STATUS_SALI:
        return camera_solicitata

    # Căutare BFS pe graful secției
    sali_posibile = deque(SPITAL_GRAF.get(nivel_prioritate, ["Sala 3"]))
    while sali_posibile:
        camera = sali_posibile.popleft()
        if STATUS_SALI.get(camera, True):
            return camera
            
    return camera_solicitata or "Sala 1"

def elibereaza_camera(nume_camera: str):
    """Marchează o sală ca fiind liberă"""
    if nume_camera in STATUS_SALI:
        STATUS_SALI[nume_camera] = True
        return True
    return False
