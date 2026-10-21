// Strat unic de acces la date: paginile apelează doar Api.*, nu fetch direct.
// Backend-ul (FastAPI) are doar două rute:
//   POST /adauga-pacient -> {mesaj, token, scor_atribuit}
//   GET  /coada-pacienti -> {in_asteptare: [{token, scor_curent}]}
// Ce nu există în backend (cheamă următorul, schimbare prioritate, lista
// chemaților) ținem local, în localStorage.
const Api = (() => {
  const C = window.SAFEQ;
 
  async function http(path, method = "GET", body) {
    const r = await fetch(C.API_BASE + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) {
      // FastAPI trimite erorile în "detail"; la validare (422) e listă, deci o ignorăm
      const j = await r.json().catch(() => ({}));
      const detail = typeof j.detail === "string" ? j.detail : null;
      throw new Error(j.error || detail || `Eroare ${r.status}`);
    }
    return r.json();
  }
 
  // ---------- stare locală (ce nu oferă backend-ul) ----------
  // meta:   date per token (nivel, simptome, ora sosirii, prioritate modificată)
  // called: pacienții chemați, afișați pe ecranul din sala de așteptare
  const LKEY = "safeq_local";
  const loadLocal = () => {
    try { return JSON.parse(localStorage.getItem(LKEY)) || { meta: {}, called: [] }; }
    catch { return { meta: {}, called: [] }; }
  };
  const saveLocal = s => localStorage.setItem(LKEY, JSON.stringify(s));
 
  // Backend-ul întoarce doar scorul, așa că deducem nivelul din el
  const levelFromScore = sc =>
    sc >= 100 ? "red" : sc >= 80 ? "orange" : sc >= 50 ? "yellow" : sc >= 20 ? "green" : "blue";
 
  // Semnele de alarmă din formular -> câmpurile din backend
  const FLAG_MAP = {
    not_breathing: "nu_respira",
    unconscious: "inconstient",
    chest_pain: "durere_toracica_severa",
    bleeding: "sangerare_controlabila",
    fracture: "fractura"
  };
 
  // Backend-ul cere int pentru puls/tensiune/spo2 și nu acceptă NaN
  const intOrNull = v => (v == null || Number.isNaN(v)) ? null : Math.round(v);
  const numOrNull = v => (v == null || Number.isNaN(v)) ? null : v;
 
  // ---------- API real (backend FastAPI) ----------
  const real = {
    async createPatient({ vitals, symptoms, red_flags }) {
      const payload = {
        puls: intOrNull(vitals.pulse),
        tensiune_sistolica: intOrNull(vitals.systolic),
        tensiune_diastolica: intOrNull(vitals.diastolic),
        spo2: intOrNull(vitals.spo2),
        temperatura: numOrNull(vitals.temp),
        simptome: symptoms || ""
      };
      Object.values(FLAG_MAP).forEach(k => { payload[k] = false; });
      red_flags.forEach(f => { if (FLAG_MAP[f]) payload[FLAG_MAP[f]] = true; });
 
      const r = await http("/adauga-pacient", "POST", payload);
      const level = levelFromScore(r.scor_atribuit);
 
      const s = loadLocal();
      // la repornirea backend-ului tokenurile se repetă, deci scoatem urmele vechi
      s.called = s.called.filter(c => c.token !== r.token);
      s.meta[r.token] = { level, arrived: Date.now(), symptoms: symptoms || "" };
      saveLocal(s);
 
      return { token: r.token, level, score: r.scor_atribuit };
    },
 
    async getQueue() {
      const data = await http("/coada-pacienti");
      const s = loadLocal();
      const called = new Set(s.called.map(c => c.token));
 
      return data.in_asteptare
        .filter(p => !called.has(p.token)) // cei chemați ies din coadă
        .map(p => {
          const m = s.meta[p.token];
          // dacă asistenta a schimbat prioritatea, recalculăm scorul local
          const score = (m && m.overridden)
            ? m.base + C.WAIT_BONUS_PER_MIN * ((Date.now() - m.scoreStart) / 60000)
            : p.scor_curent;
          return {
            token: p.token,
            level: m ? m.level : levelFromScore(p.scor_curent),
            score: +score.toFixed(1),
            wait_min: m ? Math.floor((Date.now() - m.arrived) / 60000) : 0,
            symptoms: m ? m.symptoms : ""
          };
        })
        .sort((a, b) => b.score - a.score);
    },
 
    async callNext({ room }) {
      const q = await real.getQueue();
      if (!q.length) return { token: null };
      const top = q[0];
      const s = loadLocal();
      s.called.push({ token: top.token, room, level: top.level, calledAt: Date.now() });
      saveLocal(s);
      return { token: top.token, room, level: top.level };
    },
 
    async setPriority(token, level, justification) {
      if (!justification.trim()) throw new Error("Justificarea este obligatorie.");
      const s = loadLocal();
      const m = s.meta[token] || { arrived: Date.now(), symptoms: "" };
      s.meta[token] = {
        ...m, level, overridden: true,
        base: C.LEVELS[level].base, scoreStart: Date.now(), justification
      };
      saveLocal(s);
      return { ok: true };
    },
 
    async getCalled() {
      return loadLocal().called
        .sort((a, b) => b.calledAt - a.calledAt)
        .slice(0, 4) // ecranul arată ultimii 4
        .map(c => ({ token: c.token, room: c.room, level: c.level }));
    }
  };
 
  // ---------- MOCK (USE_MOCK:true, merge fără backend) ----------
  const KEY = "safeq_mock";
  const load = () => JSON.parse(localStorage.getItem(KEY) || '{"n":0,"p":[]}');
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const waitMin = p => (Date.now() - p.created) / 60000;
  const score = p => p.base + C.WAIT_BONUS_PER_MIN * waitMin(p);
 
  function levelFromFlags(f) {
    if (f.includes("not_breathing") || f.includes("unconscious")) return "red";
    if (f.includes("chest_pain") || f.includes("low_spo2")) return "orange";
    if (f.includes("bleeding") || f.includes("fracture")) return "yellow";
    return "green";
  }
  const view = p => ({ token: p.token, level: p.level, score: +score(p).toFixed(1),
                       wait_min: Math.floor(waitMin(p)), symptoms: p.symptoms, room: p.room });
 
  const mock = {
    async createPatient({ vitals, symptoms, red_flags }) {
      const s = load(); const flags = [...red_flags];
      if (vitals.spo2 && vitals.spo2 < 90) flags.push("low_spo2");
      const level = levelFromFlags(flags);
      s.n++; const token = "A-" + String(s.n).padStart(3, "0");
      s.p.push({ token, level, base: C.LEVELS[level].base, created: Date.now(), symptoms, vitals, status: "waiting" });
      save(s); return { token, level, score: C.LEVELS[level].base };
    },
    async getQueue() {
      return load().p.filter(p => p.status === "waiting").sort((a, b) => score(b) - score(a)).map(view);
    },
    async callNext({ room }) {
      const s = load(); const w = s.p.filter(p => p.status === "waiting").sort((a, b) => score(b) - score(a));
      if (!w.length) return { token: null };
      w[0].status = "called"; w[0].room = room; w[0].calledAt = Date.now(); save(s);
      return { token: w[0].token, room, level: w[0].level };
    },
    async setPriority(token, level, justification) {
      if (!justification.trim()) throw new Error("Justificarea este obligatorie.");
      const s = load(); const p = s.p.find(x => x.token === token);
      p.level = level; p.base = C.LEVELS[level].base; p.created = Date.now(); save(s); return { ok: true };
    },
    async getCalled() {
      return load().p.filter(p => p.status === "called").sort((a, b) => b.calledAt - a.calledAt).slice(0, 4).map(view);
    }
  };
 
  return C.USE_MOCK ? mock : real;
})();
 
// Badge de prioritate (textContent, deci fără risc XSS)
function levelBadge(level) {
  const b = document.createElement("span");
  b.className = "badge lvl-" + level; b.textContent = SAFEQ.LEVELS[level].label; return b;
}