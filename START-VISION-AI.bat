@echo off
setlocal
title Vision AI Science Lab

cd /d "%~dp0"

echo ==========================================
echo       VISION AI SCIENCE LAB LAUNCHER
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not in PATH.
  echo Install Node.js 22 or newer, then run this file again.
  echo https://nodejs.org/
  goto :failed
)

if not exist ".openai" mkdir ".openai"
if not exist ".openai\hosting.json" (
  echo {}>".openai\hosting.json"
  echo Created missing .openai\hosting.json
)

if not exist "node_modules\" (
  echo Installing packages for the first launch...
  call npm.cmd install
  if errorlevel 1 goto :failed
)

set "WRANGLER_LOG_PATH=.wrangler/wrangler.log"
set "WRANGLER_WRITE_LOGS=false"
set "MINIFLARE_REGISTRY_PATH=.wrangler/registry"

echo.
echo Starting Vision AI Science Lab...
echo Your browser will open at http://localhost:5173
echo Keep this window open while using the website.
echo Press Ctrl+C here when you want to stop it.
echo.

start "" "http://localhost:5173"
call npx.cmd vite
if errorlevel 1 goto :failed
goto :end

:failed
echo.
echo The launcher could not start the website.
echo Copy or photograph the error above and send it to ChatGPT.
pause
exit /b 1

:end
endlocal
