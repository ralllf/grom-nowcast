#!/usr/bin/env bash
# Tear down only PIDs this verification run started. Evidence is not touched.
set -euo pipefail

RUN_DIR="${VERIFY_GROM_RUN_DIR:-/tmp/verify-grom}"
META="$RUN_DIR/launch.json"

if [[ ! -f "$META" ]]; then
  echo "Nothing to clean: $META missing (this run did not launch, or already cleaned)."
  exit 0
fi

python3 - "$META" "$RUN_DIR" <<'PY'
import json, os, signal, sys, time, shutil
meta_path, run_dir = sys.argv[1:]
meta = json.load(open(meta_path))
pids = []
for key in ("vitePid", "chromePid"):
    pid = meta.get(key)
    if isinstance(pid, int) and pid > 1:
        pids.append((key, pid))

def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

for name, pid in pids:
    if not alive(pid):
        print(f"{name} {pid} already gone")
        continue
    print(f"SIGTERM {name} {pid}")
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError as e:
        print(f"  {e}")
        continue
    for _ in range(40):
        if not alive(pid):
            break
        time.sleep(0.1)
    if alive(pid):
        print(f"SIGKILL {name} {pid}")
        try:
            os.kill(pid, signal.SIGKILL)
        except OSError:
            pass

profile = meta.get("chromeProfile") or os.path.join(run_dir, "chrome-profile")
if os.path.isdir(profile):
    shutil.rmtree(profile, ignore_errors=True)
    print(f"removed chrome profile {profile}")

os.remove(meta_path)
print(f"removed {meta_path}")
print("evidence at .cursor/skills/verify-grom/evidence/ is untouched")
PY
