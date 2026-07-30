#!/usr/bin/env bash
# Launches ArturaLabs detached so this window can be closed.
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo; echo "   Not set up yet. Run \"OPEN ARTURALABS.command\" first."; echo
  read -n 1 -s -r; exit 1
fi
APP="node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
if [ -x "$APP" ]; then nohup "$APP" . >/dev/null 2>&1 &
else nohup npx electron . >/dev/null 2>&1 & fi
sleep 1
exit 0
