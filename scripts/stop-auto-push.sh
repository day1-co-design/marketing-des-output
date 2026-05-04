#!/usr/bin/env bash
set -euo pipefail

pid_file="/private/tmp/marketing-des-output-auto-push.pid"

if [ ! -f "$pid_file" ]; then
  echo "Auto-push is not running."
  exit 0
fi

pid="$(cat "$pid_file")"
if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
  kill "$pid"
  echo "Stopped marketing-des-output auto-push. PID: $pid"
  pkill -f "auto-push-marketing-output.sh" >/dev/null 2>&1 || true
else
  echo "Auto-push process was not running."
fi

rm -f "$pid_file"
