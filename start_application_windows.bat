@echo off
echo ====================================================
echo 🚀 Starting Courier Management System
echo ====================================================
echo 📁 Project: %CD%
echo 🌐 URL: http://localhost:5000
echo ⏹️ Press Ctrl+C to stop the server
echo ====================================================

REM Load environment variables from .env file and start the application
npx tsx server/index.ts

if errorlevel 1 (
    echo.
    echo ❌ Failed to start application
    echo 💡 Make sure you have:
    echo    - Node.js installed
    echo    - PostgreSQL running
    echo    - .env file with DATABASE_URL
    echo.
    pause
) else (
    echo.
    echo ✅ Application started successfully
)