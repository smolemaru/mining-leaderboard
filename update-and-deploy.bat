@echo off
echo Updating leaderboard data...
node backend/generate-static.js

if %ERRORLEVEL% NEQ 0 (
    echo Failed to generate leaderboard data
    pause
    exit /b 1
)

echo Data generated successfully
echo Deploying to Vercel...
vercel --prod

echo Done!
pause 