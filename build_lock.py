# 실제 기출 문제은행(data/*.js) -> 암호화(past.enc)
#
#   python build_lock.py
#   python build_lock.py --pw <교사용 암호>      암호를 바꿀 때만
#
# 왜 이렇게 하나:
#   정적 호스팅(GitHub Pages)에서는 "화면에 비밀번호 칸"을 두어도 보호가 전혀 안 된다.
#   data/r2023-1.js 주소를 직접 치면 기출이 그대로 받아지기 때문이다.
#   그래서 파일 자체를 AES-GCM 으로 실제 암호화해서 올리고, 브라우저에서 WebCrypto 로 푼다.
#
# 무엇이 잠기고 무엇이 안 잠기나:
#   잠김   실제 기출 — 회차 5개 + 자주 나오는 120선 (기출공략집 전사)
#   안 잠김 개념 문항 — comhwal2(개념게임) 저장소에서 불러오는 자작 문항
#   그래서 코드가 없어도 개념 모의고사는 그대로 풀 수 있다.
#
# 암호가 두 종류인 이유 (수업용):
#   교사용 - 문구형, 만료 없음. 열면 그 주 학생 코드가 화면에 나온다.
#   학생용 - 8자리 숫자, 그 주 월요일 ~ 다음 월요일 7일만.
#   본문은 임의의 내용키(CK)로 한 번 암호화하고, CK 를 암호마다 따로 감싼다.
#   감싼 것들은 순서를 섞어 어느 것이 교사용인지 알 수 없다.
#   기간은 암호문 '안에' 들어 있어 화면이나 코드를 고쳐도 넘길 수 없다.
#
#   시크릿·기준일·접두어는 _weekly/secret.json 에 모아 두고 모든 도구가 함께 쓴다.
#   그래서 어느 도구에서든 같은 8자리가 통하고, 다시 빌드해도 코드가 바뀌지 않는다.
#
# 주의: 평문 data/best-*.js · data/r20*.js 는 .gitignore 에 있다. 절대 커밋하지 말 것.
#       암호를 이 스크립트에 적어 두지 말 것 - 공개 저장소에 그대로 남는다.
import io, os, re, json, gzip, base64, argparse, sys, secrets, subprocess, tempfile
from datetime import date
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "_weekly"))
import weekly                                   # 도구 공용 주간 코드
OUT = os.path.join(HERE, "past.enc")
ITER = 200_000

# 잠글 파일. past-core.js 가 먼저 와야 PAST 가 만들어진다 (순서 고정)
PARTS = ["best-1", "best-2", "best-3", "best-4",
         "r2023-1", "r2023-2", "r2023-3", "r2022-1", "r2022-2"]


def extract_json():
    """기출 파일들을 node 로 평가해 한 덩어리 JSON 으로 만든다.

    data/*.js 는 브라우저용 IIFE 라 window.COMHWAL2_PAST 에 쌓인다.
    global.window 를 만들어 두면 node 에서도 그대로 돈다.
    PAST.T(표 생성기)는 파일을 읽는 동안 이미 HTML 문자열로 바뀌므로
    결과 JSON 에는 함수가 남지 않는다."""
    lines = ["global.window = {};", "require('./data/past-core.js');"]
    for p in PARTS:
        lines.append("require('./data/%s.js');" % p)
    lines.append("const P = global.window.COMHWAL2_PAST;")
    lines.append("process.stdout.write(JSON.stringify({v:1, best:P.best, rounds:P.rounds}));")
    with tempfile.NamedTemporaryFile("w", suffix=".js", dir=HERE, delete=False, encoding="utf-8") as f:
        f.write("\n".join(lines))
        tmp = f.name
    try:
        r = subprocess.run(["node", tmp], capture_output=True, text=True,
                           encoding="utf-8", cwd=HERE)
        if r.returncode:
            raise SystemExit("node 평가 실패:\n" + r.stderr)
        return r.stdout
    finally:
        os.remove(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pw", help="교사용 암호 (만료 없음). 생략하면 _weekly/secret.json 의 teacher_pw 를 쓴다")
    a = ap.parse_args()

    cfg = weekly.load()
    # 교사용 암호도 주간 코드와 같은 공용 설정에서 가져온다 — 도구끼리 어긋날 일이 없다.
    if not a.pw:
        a.pw = cfg.get("teacher_pw")
        if not a.pw:
            raise SystemExit("교사용 암호가 없습니다 - --pw 로 주거나 _weekly/secret.json 에 teacher_pw 를 넣으세요")
    start = date.fromisoformat(cfg["epoch"])
    nweeks = cfg["weeks"]

    for p in PARTS:
        fp = os.path.join(HERE, "data", p + ".js")
        if not os.path.exists(fp):
            raise SystemExit("평문 기출 파일이 없습니다: data/%s.js\n"
                             "(이 파일들은 .gitignore 라 다른 기기에는 없습니다. 원본이 있는 PC에서 빌드하세요)" % p)

    payload = extract_json()
    data = json.loads(payload)
    rounds = data["rounds"]
    best = data["best"]
    nq = sum(len(r.get("qs") or []) for r in rounds)
    nb = len(best.get("items") or [])
    raw = payload.encode("utf-8")
    gz = gzip.compress(raw, 9)

    # 1) 본문을 임의의 내용키(CK)로 한 번만 암호화
    CK = secrets.token_bytes(32)
    nonce = secrets.token_bytes(12)
    body = nonce + AESGCM(CK).encrypt(nonce, gz, None)   # nonce 를 앞에 붙여 한 덩어리로

    # 2) 암호마다 CK 를 감싼다 (salt 를 공유해 해제 시 PBKDF2 는 딱 1회)
    salt = secrets.token_bytes(16)
    MASTER = base64.b64decode(cfg["secret"])             # 도구 공용 - 새로 만들지 않는다

    def derive(p):
        return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                          salt=salt, iterations=ITER).derive(p.encode("utf-8"))

    def wrap(p, info):
        iv = secrets.token_bytes(12)
        blob = AESGCM(derive(p)).encrypt(iv, json.dumps(info).encode("utf-8"), None)
        return {"iv": base64.b64encode(iv).decode(),
                "blob": base64.b64encode(blob).decode()}

    ck_b64 = base64.b64encode(CK).decode()
    keys = [wrap(a.pw, {"ck": ck_b64, "exp": None, "role": "teacher", "label": "교사용",
                        "ms": base64.b64encode(MASTER).decode(),
                        "epoch": start.isoformat(), "weeks": nweeks,
                        "prefix": cfg["prefix"]})]

    print("  키 감싸기 교사용 1개 + 학생용 %d주치 ..." % nweeks, end="", flush=True)
    sheet = weekly.weeks(cfg)
    for n, d0, d1, c in sheet:
        keys.append(wrap(c, {"ck": ck_b64, "nbf": d0.isoformat(), "exp": d1.isoformat(),
                             "role": "student", "label": d0.isoformat()}))
    print(" 완료")
    secrets.SystemRandom().shuffle(keys)                 # 어느 것이 교사용인지 감춘다

    build_id = secrets.token_hex(4)
    io.open(OUT, "w", encoding="utf-8").write(json.dumps({
        "v": 1, "cipher": "AES-GCM", "gz": True,
        "build": build_id,
        "n": nq + nb, "nrounds": len(rounds), "nq": nq, "nbest": nb,
        "kdf": {"name": "PBKDF2", "hash": "SHA-256", "iter": ITER,
                "salt": base64.b64encode(salt).decode()},
        "data": base64.b64encode(body).decode(),
        "keys": keys,
    }))

    # 화면이 부르는 스크립트 주소에도 표식을 박는다.
    # 안 하면 브라우저가 옛 app.js 를 캐시에서 꺼내 써서 조용히 어긋난다.
    fp = os.path.join(HERE, "index.html")
    html = io.open(fp, encoding="utf-8").read()
    fixed = re.sub(r'(<body[^>]*data-build=")[^"]*(")', r'\g<1>' + build_id + r'\g<2>', html)
    if fixed != html:
        io.open(fp, "w", encoding="utf-8").write(fixed)

    cur = weekly.this_week(cfg)
    print("  기출 회차 %d개 · %d문항 + 120선 %d문항 = %d문항"
          % (len(rounds), nq, nb, nq + nb))
    print("  원본 %dKB -> gzip %dKB -> past.enc %dKB  (빌드 표식 %s)"
          % (len(raw) // 1024, len(gz) // 1024, os.path.getsize(OUT) // 1024, build_id))
    print("")
    print("  교사용 암호 : %s   (만료 없음)" % a.pw)
    print("  학생 코드   : %d주치  %s ~ %s  (도구 공용)" % (nweeks, start, sheet[-1][2]))
    if cur:
        print("  이번 주 코드: %s %s   (%s ~ %s)" % (cur[3][:4], cur[3][4:], cur[1], cur[2]))


if __name__ == "__main__":
    main()
