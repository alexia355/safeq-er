"""Ruleaza teste_api.json pe backend-ul vostru (doar biblioteca standard).

Exemple:
  python ruleaza_teste.py --url http://localhost:8000/adauga-pacient --format backend
  python ruleaza_teste.py --url http://localhost:5000/api/patients  --format frontend
"""
import argparse, json, re, sys, urllib.request, urllib.error

LEVEL_FROM_SCORE = {100: "red", 80: "orange", 50: "yellow", 20: "green", 10: "blue"}

def post(url, body):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--format", choices=["frontend", "backend"], default="frontend")
    ap.add_argument("--file", default="teste_api.json")
    a = ap.parse_args()
    cases = json.load(open(a.file, encoding="utf-8"))
    fails, ok = [], 0
    for c in cases:
        body = c["payload_frontend" if a.format == "frontend" else "payload_backend"]
        status, resp = post(a.url, body)
        want = c.get("expected_http", 200)
        if want != 200:
            good = 400 <= status < 500
            msg = f"asteptat 4xx, primit {status}"
        else:
            score = resp.get("score", resp.get("scor_atribuit"))
            level = resp.get("level") or LEVEL_FROM_SCORE.get(score)
            tok = str(resp.get("token", ""))
            problems = []
            if status != 200: problems.append(f"HTTP {status}")
            if level not in c["niveluri_acceptate"]: problems.append(f"nivel {level} (scor {score}), asteptat {c['niveluri_acceptate']}")
            if not re.fullmatch(r"#?A-\d+", tok): problems.append(f"token neasteptat: {tok!r}")
            good, msg = not problems, "; ".join(problems)
        if good: ok += 1
        else: fails.append((c["id"], c.get("nota", c.get("payload_frontend", {}).get("symptoms", "")), msg))
    print(f"{ok}/{len(cases)} teste trecute")
    for f in fails: print(" ESEC", f[0], "|", str(f[1])[:70], "|", f[2])
    sys.exit(1 if fails else 0)

main()
