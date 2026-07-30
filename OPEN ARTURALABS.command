#!/usr/bin/env bash
cd "$(dirname "$0")"
clear
echo; echo "   ArturaLabs"; echo "   =========="; echo

if ! command -v node >/dev/null 2>&1; then
  echo "   Node.js is not installed on this Mac."
  echo "   1. Go to  https://nodejs.org"
  echo "   2. Click the big green LTS button and install it"
  echo "   3. Double-click this file again"
  echo
  open "https://nodejs.org"
  read -n 1 -s -r -p "   Press any key to close."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "   First time here. Setting up - takes a few minutes, happens once."
  echo
  echo "   [1/2] Downloading what the app needs..."
  npm install --no-audit --no-fund || { echo; echo "   Setup failed - send me the text above."; read -n 1 -s -r; exit 1; }
  echo "   [2/2] Downloading fonts..."
  node scripts/fetch-fonts.js
  echo; echo "   Setup finished."; echo
fi

[ -f src/renderer/fonts/fonts.css ] || node scripts/fetch-fonts.js

echo "   Opening ArturaLabs..."
echo "   (leave this window open while you use the app)"
echo
npm start
