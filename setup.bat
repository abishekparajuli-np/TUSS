@echo off
REM Setup script for THERMASCAN AI (Windows)

setlocal enabledelayedexpansion

echo.
echo 🏥 THERMASCAN AI - Setup Script (Windows)
echo ==========================================
echo.

REM Check prerequisites
echo 📋 Checking prerequisites...

python --version >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Python not found. Please install Python 3.9+
    pause
    exit /b 1
)

node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

echo ✅ Prerequisites verified
echo.

REM Backend setup
echo 🔧 Setting up backend...
cd backend

if not exist "venv" (
    python -m venv venv
    echo ✅ Virtual environment created
)

call venv\Scripts\activate.bat
pip install -r requirements.txt
echo ✅ Backend dependencies installed

cd ..

REM Frontend setup
echo.
echo ⚙️  Setting up frontend...
cd frontend

call npm install
echo ✅ Frontend dependencies installed

if not exist ".env.local" (
    copy .env.example .env.local
    echo ⚠️  Created .env.local - Please update with Firebase credentials
)

cd ..

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. Update frontend\.env.local with Firebase credentials
echo 2. Update backend\inference_server.py with thermal camera STREAM_URL
echo 3. Run the backend: cd backend ^&^& python inference_server.py
echo 4. Run the frontend: cd frontend ^&^& npm start
echo.
echo 🌐 Access the app at http://localhost:3000
echo.
pause
