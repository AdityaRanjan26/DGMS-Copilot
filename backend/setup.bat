@echo off
echo.
echo ============================================================
echo   DGMS Copilot Backend — Setup Script
echo ============================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not on PATH.
    echo Please install Python 3.9+ from https://python.org
    pause
    exit /b 1
)

echo Python found:
python --version
echo.

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo Virtual environment created.
) else (
    echo Virtual environment already exists.
)

echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Installing Python dependencies...
pip install --upgrade pip --quiet
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Setting up environment file...
echo ============================================================

if not exist ".env" (
    copy .env.example .env
    echo.
    echo Created .env from template.
    echo IMPORTANT: Edit .env to customize your Ollama URL or Model if needed.
    echo Make sure you have installed Ollama and pulled the required models:
    echo ollama pull qwen3:8b
    echo ollama pull llama3.1:8b
) else (
    echo .env already exists — skipping.
)

echo.
echo ============================================================
echo   Running document ingestion...
echo ============================================================
echo.
python ingest_documents.py
if errorlevel 1 (
    echo ERROR: Ingestion failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Setup complete!
echo ============================================================
echo.
echo To start the backend server, run:
echo   start_backend.bat
echo.
echo Or manually:
echo   cd backend
echo   venv\Scripts\activate
echo   uvicorn main:app --reload --port 8000
echo.
pause
