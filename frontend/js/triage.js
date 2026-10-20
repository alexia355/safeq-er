const f = document.getElementById("f"), msg = document.getElementById("msg");
const res = document.getElementById("result");
const num = id => parseFloat(document.getElementById(id).value);

f.addEventListener("submit", async e => {
  e.preventDefault(); msg.className = "msg"; msg.textContent = "";
  const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    const r = await Api.createPatient({
      vitals: { pulse: num("pulse"), systolic: num("sys"), diastolic: num("dia"), spo2: num("spo2"), temp: num("temp") },
      symptoms: document.getElementById("sym").value.trim(),
      red_flags: [...f.querySelectorAll("[name=flag]:checked")].map(c => c.value)
    });
    document.getElementById("tok").textContent = r.token;
    const l = document.getElementById("lvl"); l.replaceChildren(levelBadge(r.level));
    document.getElementById("scr").textContent = r.score;
    f.hidden = true; res.hidden = false;
  } catch (err) { msg.className = "msg err"; msg.textContent = err.message; }
  finally { btn.disabled = false; }
});
document.getElementById("again").onclick = () => { f.reset(); f.hidden = false; res.hidden = true; };