@echo off
echo Setting up Mining Leaderboard Backend...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js (v16+) and try again.
    exit /b 1
)

REM Install dependencies
echo Installing dependencies...
call npm install

REM Start the server
echo Starting the server...
node server.js 