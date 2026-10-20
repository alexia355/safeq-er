// Strat unic de acces la date. Restul paginilor apelează doar Api.* (nu fetch direct).
// Contract așteptat de la backend (adaptează în backend/app.py sau aici):
//   POST /patients            {vitals, symptoms, red_flags}  -> {token, level, score}
//   GET  /queue                                              -> [{token, level, score, wait_min, symptoms}]
//   POST /call-next           {room}                         -> {token, room} | {token:null}
//   POST /patients/<t>/priority {level, justification}       -> {ok:true}
//   GET  /called                                             -> [{token, room, level}]
const Api = (() => {
  const C = window.SAFEQ;

  async function http(path, method = "GET", body) {
    const r = await fetch(C.API_BASE + path, {
      method, headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Eroare ${r.status}`);
    return r.json();
  }

  // ---------- MOCK (localStorage, partajat între taburi) ----------
  const KEY = "safeq_mock";
  const load = () => JSON.parse(localStorage.getItem(KEY) || '{"n":0,"p":[]}');
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const waitMin = p => (Date.now() - p.created) / 60000;
  const score = p => p.base + C.WAIT_BONUS_PER_MIN * waitMin(p);

  function levelFromFlags(f) {           // reguli provizorii din notițe
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

  return C.USE_MOCK ? mock : {
    createPatient: d => http("/patients", "POST", d),
    getQueue: () => http("/queue"),
    callNext: d => http("/call-next", "POST", d),
    setPriority: (t, level, justification) => http(`/patients/${encodeURIComponent(t)}/priority`, "POST", { level, justification }),
    getCalled: () => http("/called")
  };
})();

// Helper comun: element badge de prioritate (textContent => fără XSS)
function levelBadge(level) {
  const b = document.createElement("span");
  b.className = "badge lvl-" + level; b.textContent = SAFEQ.LEVELS[level].label; return b;
}