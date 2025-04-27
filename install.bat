@echo off
echo Installing and setting up BIGCOIN Mining Leaderboard...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed. Please install Node.js (v16+) and try again.
    exit /b 1
)

REM Install backend dependencies
echo Installing backend dependencies...
cd backend
call npm install
echo Backend dependencies installed successfully!
cd ..

REM Instructions for running the application
echo.
echo Installation complete! To run the application:
echo.
echo 1. Start the backend server:
echo    cd backend
echo    node server.js
echo.
echo 2. Open frontend/index.html in your browser
echo.
echo Or use the setup scripts:
echo    backend/setup.bat - To start the backend server
echo.
pause 