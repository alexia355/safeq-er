const rows = document.getElementById("rows"), msg = document.getElementById("msg");
const dlg = document.getElementById("dlg"); let editing = null;
const roomSel = document.getElementById("room"), nl = document.getElementById("nl");
SAFEQ.ROOMS.forEach(r => roomSel.add(new Option(r, r)));
Object.entries(SAFEQ.LEVELS).forEach(([k, v]) => nl.add(new Option(v.label, k)));

function td(content) { const c = document.createElement("td"); c.append(content); return c; }

async function refresh() {
  try {
    const q = await Api.getQueue(); rows.replaceChildren();
    document.getElementById("empty").hidden = q.length > 0;
    q.forEach(p => {
      const tr = document.createElement("tr");
      const t = document.createElement("span"); t.className = "token"; t.textContent = p.token;
      const b = document.createElement("button"); b.className = "secondary"; b.textContent = "Modifică";
      b.onclick = () => { editing = p; document.getElementById("dtok").textContent = p.token; nl.value = p.level; dlg.showModal(); };
      tr.append(td(t), td(levelBadge(p.level)), td(p.score), td(p.wait_min + " min"), td(p.symptoms || "–"), td(b));
      rows.append(tr);
    });
  } catch (e) { msg.className = "msg err"; msg.textContent = e.message; }
}

document.getElementById("next").onclick = async () => {
  msg.className = "msg";
  try {
    const r = await Api.callNext({ room: roomSel.value });
    msg.textContent = r.token ? `Chemat: ${r.token} → ${r.room}` : "Coada este goală.";
    refresh();
  } catch (e) { msg.className = "msg err"; msg.textContent = e.message; }
};

document.getElementById("cancel").onclick = () => dlg.close();
document.getElementById("ovf").addEventListener("submit", async e => {
  e.preventDefault();
  try { await Api.setPriority(editing.token, nl.value, document.getElementById("just").value); dlg.close();
        document.getElementById("just").value = ""; refresh(); }
  catch (err) { msg.className = "msg err"; msg.textContent = err.message; dlg.close(); }
});

refresh(); setInterval(refresh, SAFEQ.POLL_MS);