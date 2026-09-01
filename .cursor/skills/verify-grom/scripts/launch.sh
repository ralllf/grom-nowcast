#!/usr/bin/env bash
# Start `npm run dev` for GROM verification. Refuses if :8080 is already taken.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
RUN_DIR="${VERIFY_GROM_RUN_DIR:-/tmp/verify-grom}"
BASE="${BASE:-http://127.0.0.1:8080}"
mkdir -p "$RUN_DIR"

if [[ -f "$RUN_DIR/launch.json" ]]; then
  echo "launch.json already exists at $RUN_DIR/launch.json — refuse to double-start." >&2
  cat "$RUN_DIR/launch.json" >&2
  exit 2
fi

if curl -fsS --max-time 2 "$BASE/" >/dev/null 2>&1; then
  echo "REFUSE: $BASE already serves HTTP. Isolation: one instance on :8080 (strictPort)." >&2
  echo "If that is leftover from a crashed run, delete $RUN_DIR/launch.json only after you know the PID is dead." >&2
  exit 2
fi

LOG="$RUN_DIR/vite.log"
cd "$ROOT"
# New session so cleanup can SIGTERM the whole group (npm + vite child), not just the wrapper.
setsid npm run dev >"$LOG" 2>&1 < /dev/null &
VITE_PID=$!

# Wait until Vite prints ready or GET / is 200.
ready=0
for i in $(seq 1 60); do
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "vite exited early. last log:" >&2
    tail -n 40 "$LOG" >&2
    exit 1
  fi
  if grep -q "Local:   http://localhost:8080/" "$LOG" 2>/dev/null; then
    if curl -fsS --max-time 2 "$BASE/" | grep -q "<title>GROM</title>"; then
      ready=1
      break
    fi
  fi
  sleep 0.5
done

if [[ "$ready" -ne 1 ]]; then
  echo "Launch timed out waiting for GROM on $BASE" >&2
  tail -n 40 "$LOG" >&2
  kill "$VITE_PID" 2>/dev/null || true
  wait "$VITE_PID" 2>/dev/null || true
  exit 1
fi

python3 - "$RUN_DIR/launch.json" "$VITE_PID" "$BASE" "$LOG" <<'PY'
import json, os, sys, time
path, pid_s, base, log = sys.argv[1:]
pid = int(pid_s)
try:
    pgid = os.getpgid(pid)
except OSError:
    pgid = pid
json.dump({
    "vitePid": pid,
    "vitePgid": pgid,
    "base": base,
    "log": log,
    "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
}, open(path, "w"), indent=2)
print(open(path).read())
PY
