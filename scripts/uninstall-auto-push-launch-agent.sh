#!/usr/bin/env bash
set -euo pipefail

labels=(
  "com.day1-co-design.marketing-des-output.autopush"
  "com.semikim.marketing-des-output.autopush"
)
uid="$(id -u)"

for label in "${labels[@]}"; do
  plist="$HOME/Library/LaunchAgents/$label.plist"
  launchctl bootout "gui/$uid" "$plist" >/dev/null 2>&1 || true
  rm -f "$plist"
done

echo "Uninstalled marketing-des-output auto-push agents"
