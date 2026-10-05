@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 22 or newer from https://nodejs.org/
  pause
  exit /b 1
)
echo Starting InfraPredict AI...
start "InfraPredict AI" cmd /k node server.js
timeout /t 2 >nul
start http://localhost:3000
