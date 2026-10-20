// Ecran public: doar token + sală. Nicio dată medicală sau personală.
let last = null;
const COLORS = { red: "#d62828", orange: "#f77f00", yellow: "#f2c200", green: "#2a9d4a", blue: "#2b6cb0" };
async function refresh() {
  try {
    const called = await Api.getCalled(); if (!called.length) return;
    const [cur, ...rest] = called;
    document.getElementById("tok").textContent = cur.token;
    document.getElementById("room").textContent = "→ " + cur.room;
    if (last !== cur.token) { const n = document.getElementById("now"); n.classList.remove("flash"); void n.offsetWidth; n.classList.add("flash"); last = cur.token; }
    const ul = document.getElementById("recent"); ul.replaceChildren();
    rest.forEach(p => { const li = document.createElement("li"); const d = document.createElement("span");
      d.className = "dot"; d.style.background = "#5b6b78";
      const t = document.createElement("span"); t.textContent = p.token;
      const r = document.createElement("span"); r.textContent = p.room; li.append(t, r); ul.append(li); });
  } catch (e) { /* ecranul rămâne pe ultima stare */ }
}
refresh(); setInterval(refresh, SAFEQ.POLL_MS);