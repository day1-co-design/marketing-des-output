#!/usr/bin/env bash
set -euo pipefail

pid_file="/private/tmp/marketing-des-output-auto-push.pid"
out_log="/private/tmp/marketing-des-output-auto-push.out.log"
err_log="/private/tmp/marketing-des-output-auto-push.err.log"

if [ -f "$pid_file" ]; then
  pid="$(cat "$pid_file")"
  if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
    echo "Auto-push is running. PID: $pid"
  else
    echo "Auto-push is not running. Removing stale PID file."
    rm -f "$pid_file"
  fi
else
  echo "Auto-push is not running."
fi

echo
echo "Recent output log:"
tail -n 20 "$out_log" 2>/dev/null || echo "No output log yet."

echo
echo "Recent error log:"
tail -n 20 "$err_log" 2>/dev/null || echo "No error log yet."

