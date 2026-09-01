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
def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def stop(name, pid, group=False):
    if pid is None or pid <= 1:
        return
    try:
        if group:
            os.killpg(pid, 0)
        else:
            os.kill(pid, 0)
    except OSError:
        print(f"{name} {pid} already gone")
        return
    sig_term = signal.SIGTERM
    print(f"SIGTERM {name} {pid}{' (group)' if group else ''}")
    try:
        (os.killpg if group else os.kill)(pid, sig_term)
    except OSError as e:
        print(f"  {e}")
        return
    for _ in range(50):
        try:
            (os.killpg if group else os.kill)(pid, 0)
        except OSError:
            return
        time.sleep(0.1)
    print(f"SIGKILL {name} {pid}")
    try:
        (os.killpg if group else os.kill)(pid, signal.SIGKILL)
    except OSError:
        pass

pgid = meta.get("vitePgid")
if isinstance(pgid, int):
    stop("vitePgid", pgid, group=True)
else:
    stop("vitePid", meta.get("vitePid"))
stop("chromePid", meta.get("chromePid"))

profile = meta.get("chromeProfile") or os.path.join(run_dir, "chrome-profile")
if os.path.isdir(profile):
    shutil.rmtree(profile, ignore_errors=True)
    print(f"removed chrome profile {profile}")

os.remove(meta_path)
print(f"removed {meta_path}")
print("evidence at .cursor/skills/verify-grom/evidence/ is untouched")
PY
