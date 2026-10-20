// Configurare globală. Pune USE_MOCK:false când backend-ul (backend/app.py) e pornit.
window.SAFEQ = {
  API_BASE: "http://localhost:5000/api",
  USE_MOCK: true,          // true = date simulate în localStorage (merge fără backend)
  POLL_MS: 3000,
  ROOMS: ["Sala 1", "Sala 2", "Sala 3"],
  LEVELS: {
    red:    { label: "Roșu",    base: 100, target: "Imediat" },
    orange: { label: "Portocaliu", base: 80, target: "10 min" },
    yellow: { label: "Galben",  base: 50,  target: "60 min" },
    green:  { label: "Verde",   base: 20,  target: "120 min" },
    blue:   { label: "Albastru", base: 10, target: "240 min" }
  },
  WAIT_BONUS_PER_MIN: 0.5
};