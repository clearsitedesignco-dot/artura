@echo off
rem Launches ArturaLabs detached, so this window can be closed.
rem Use "OPEN ARTURALABS.bat" instead if something is broken and you
rem need to see the error messages.
cd /d "%~dp0"

if not exist "node_modules\" (
  echo.
  echo    Not set up yet. Run "OPEN ARTURALABS.bat" first - it does the
  echo    one-time setup and shows you any problems.
  echo.
  pause
  exit /b 1
)

if exist "node_modules\electron\dist\electron.exe" (
  start "" "node_modules\electron\dist\electron.exe" "."
) else (
  start "" cmd /c "npx electron ."
)
exit
