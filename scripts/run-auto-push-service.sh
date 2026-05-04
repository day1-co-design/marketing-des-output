#!/usr/bin/env bash
set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
watch_script="$repo_dir/scripts/auto-push-marketing-output.sh"
child_pid=""

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$*"
}

stop_child() {
  if [ -n "$child_pid" ] && kill -0 "$child_pid" >/dev/null 2>&1; then
    kill "$child_pid" >/dev/null 2>&1 || true
    wait "$child_pid" >/dev/null 2>&1 || true
  fi
}

trap 'log "Service stop requested."; stop_child; exit 0' INT TERM

log "Auto-push service supervisor started for $repo_dir."

while true; do
  "$watch_script" &
  child_pid="$!"
  wait "$child_pid"
  exit_code="$?"
  child_pid=""

  log "Auto-push watcher exited with code $exit_code. Restarting in 5 seconds."
  sleep 5
done

