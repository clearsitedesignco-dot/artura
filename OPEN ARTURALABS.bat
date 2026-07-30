@echo off
title ArturaLabs
cd /d "%~dp0"
cls
echo.
echo    ArturaLabs
echo    ==========
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo    Node.js is not installed on this computer.
  echo.
  echo    1. Go to  https://nodejs.org
  echo    2. Click the big green LTS button and install it
  echo    3. Accept every default
  echo    4. Double-click this file again
  echo.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo    First time here. Setting up - takes a few minutes, happens once.
  echo.
  echo    [1/2] Downloading what the app needs...
  call npm install --no-audit --no-fund || goto :fail
  echo    [2/2] Downloading fonts...
  call node scripts/fetch-fonts.js
  echo.
  echo    Setup finished.
  echo.
)

if not exist "src\renderer\fonts\fonts.css" call node scripts/fetch-fonts.js

echo    Opening ArturaLabs...
echo    ^(leave this black window open while you use the app^)
echo.
call npm start
exit /b 0

:fail
echo.
echo    ============================================================
echo     Setup could not finish. Whatever went wrong is printed
echo     above this line - send me that text.
echo    ============================================================
echo.
pause
exit /b 1
