#!/usr/bin/env bash
set -euo pipefail

label="com.day1-co-design.marketing-des-output.autopush"
legacy_label="com.semikim.marketing-des-output.autopush"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
watch_script="$repo_dir/scripts/auto-push-marketing-output.sh"
plist_dir="$HOME/Library/LaunchAgents"
plist="$plist_dir/$label.plist"
legacy_plist="$plist_dir/$legacy_label.plist"
uid="$(id -u)"

mkdir -p "$plist_dir"
chmod +x "$watch_script"

cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$watch_script</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$repo_dir</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>AUTOPUSH_INTERVAL_SECONDS</key>
    <string>15</string>
    <key>AUTOPUSH_QUIET_SECONDS</key>
    <string>20</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/private/tmp/marketing-des-output-auto-push.out.log</string>
  <key>StandardErrorPath</key>
  <string>/private/tmp/marketing-des-output-auto-push.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$uid" "$legacy_plist" >/dev/null 2>&1 || true
rm -f "$legacy_plist"
launchctl bootout "gui/$uid" "$plist" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$uid" "$plist"
launchctl enable "gui/$uid/$label"
launchctl kickstart -k "gui/$uid/$label" >/dev/null 2>&1 || true

echo "Installed $label"
echo "Plist: $plist"
echo "Logs: /private/tmp/marketing-des-output-auto-push.out.log"
