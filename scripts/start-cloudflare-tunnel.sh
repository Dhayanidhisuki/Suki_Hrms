#!/usr/bin/env bash
# Durable Cloudflare quick tunnel to local Next.js (port 3000).
# Clears HTTP(S)/ALL proxy env — Cursor/agent proxies return bare "Unauthorized"
# and break cloudflared origin connections (malformed HTTP response).
set -euo pipefail

PORT="${TUNNEL_ORIGIN_PORT:-3000}"
LOG="${TUNNEL_LOG:-/tmp/cloudflared-suki.log}"
PIDFILE="${TUNNEL_PIDFILE:-/tmp/cloudflared-suki.pid}"
URLFILE="${TUNNEL_URLFILE:-/tmp/suki-public-url.txt}"

unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy
export NO_PROXY='*'
export no_proxy='*'

if ! curl -fsS "http://127.0.0.1:${PORT}/login" >/dev/null 2>&1; then
  echo "error: nothing healthy on 127.0.0.1:${PORT} (start Next.js first)" >&2
  exit 1
fi

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "stopping previous tunnel pid=$(cat "$PIDFILE")"
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
  sleep 1
fi
pkill -f "cloudflared tunnel .*127.0.0.1:${PORT}" 2>/dev/null || true
sleep 1

resolve_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    command -v cloudflared
    return
  fi
  # Prefer already-cached npx binary if present
  local found
  found="$(find "${TMPDIR:-/tmp}" -path '*/node_modules/cloudflared/bin/cloudflared' -type f 2>/dev/null | head -n 1 || true)"
  if [[ -n "$found" ]]; then
    echo "$found"
    return
  fi
  return 1
}

BIN="$(resolve_cloudflared || true)"
: >"$LOG"

python3 - "$BIN" "$PORT" "$LOG" "$PIDFILE" <<'PY'
import os, sys, time, pathlib, subprocess, re, shutil

bin_path = sys.argv[1] or None
port = sys.argv[2]
log = pathlib.Path(sys.argv[3])
pidf = pathlib.Path(sys.argv[4])

env = {
    k: v
    for k, v in os.environ.items()
    if k.lower() not in ("http_proxy", "https_proxy", "all_proxy", "no_proxy")
}
env["NO_PROXY"] = "*"
env["no_proxy"] = "*"

if bin_path and os.path.isfile(bin_path) and os.access(bin_path, os.X_OK):
    cmd = [bin_path, "tunnel", "--protocol", "http2", "--url", f"http://127.0.0.1:{port}"]
else:
    npx = shutil.which("npx")
    if not npx:
        print("error: cloudflared and npx not found", file=sys.stderr)
        sys.exit(1)
    cmd = [npx, "--yes", "cloudflared", "tunnel", "--protocol", "http2", "--url", f"http://127.0.0.1:{port}"]

if os.fork() == 0:
    os.setsid()
    if os.fork() == 0:
        with open(log, "ab", buffering=0) as lf:
            os.dup2(lf.fileno(), 1)
            os.dup2(lf.fileno(), 2)
            os.chdir("/")
            os.execve(cmd[0], cmd, env)
    else:
        os._exit(0)
else:
    os.wait()

url = None
for _ in range(60):
    time.sleep(0.5)
    text = log.read_text(errors="ignore")
    urls = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
    # URL banner can appear before "Registered"; accept either once URL exists
    if urls and (
        "Registered tunnel connection" in text
        or "Your quick Tunnel has been created" in text
    ):
        url = urls[-1]
        break

# Prefer the actual cloudflared binary pid over npm wrapper
try:
    out = subprocess.check_output(
        ["pgrep", "-f", f"cloudflared tunnel .*127.0.0.1:{port}"],
        text=True,
    ).strip().splitlines()
except subprocess.CalledProcessError:
    out = []
if not out:
    print("error: tunnel process did not start; see", log, file=sys.stderr)
    sys.exit(1)
pidf.write_text(out[-1] + "\n")
print(f"pid={out[-1]}")
print(f"log={log}")
if url:
    print(f"url={url}")
else:
    print("url=(pending — check log)", file=sys.stderr)
    sys.exit(2)
PY

URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | tail -n 1)"
printf '%s\n' "$URL" >"$URLFILE"
echo "wrote $URLFILE"
echo "Public URL: $URL"
echo "Sign-in: $URL/login"
