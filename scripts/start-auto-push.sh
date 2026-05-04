#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
watch_script="$repo_dir/scripts/auto-push-marketing-output.sh"
service_script="$repo_dir/scripts/run-auto-push-service.sh"
pid_file="/private/tmp/marketing-des-output-auto-push.pid"
out_log="/private/tmp/marketing-des-output-auto-push.out.log"
err_log="/private/tmp/marketing-des-output-auto-push.err.log"

if [ -f "$pid_file" ]; then
  old_pid="$(cat "$pid_file")"
  if [ -n "$old_pid" ] && kill -0 "$old_pid" >/dev/null 2>&1; then
    echo "Auto-push is already running. PID: $old_pid"
    echo "Logs: $out_log"
    exit 0
  fi
  rm -f "$pid_file"
fi

cd "$repo_dir"
chmod +x "$watch_script"
chmod +x "$service_script"

nohup "$service_script" >>"$out_log" 2>>"$err_log" &
pid="$!"
echo "$pid" > "$pid_file"

echo "Started marketing-des-output auto-push. PID: $pid"
echo "Logs: $out_log"
echo "Errors: $err_log"
