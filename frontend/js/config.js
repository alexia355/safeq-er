// Configurare globală.
// API_BASE: adresa backend-ului FastAPI, fără /api (rutele sunt direct /adauga-pacient etc.)
//           portul trebuie să fie cel din uvicorn (--port 8000)
// USE_MOCK: false = backend real, true = date simulate în localStorage
window.SAFEQ = {
  API_BASE: "http://localhost:8000",
  USE_MOCK: false,
  POLL_MS: 3000, // la câte ms se reîmprospătează coada și ecranul
  ROOMS: ["Sala 1", "Sala 2", "Sala 3"],
  LEVELS: { // base = scorul de pornire, trebuie să fie ca în backend
    red:    { label: "Roșu",    base: 100, target: "Imediat" },
    orange: { label: "Portocaliu", base: 80, target: "10 min" },
    yellow: { label: "Galben",  base: 50,  target: "60 min" },
    green:  { label: "Verde",   base: 20,  target: "120 min" },
    blue:   { label: "Albastru", base: 10, target: "240 min" }
  },
  WAIT_BONUS_PER_MIN: 0.5 // puncte adăugate pe minut de așteptare
};