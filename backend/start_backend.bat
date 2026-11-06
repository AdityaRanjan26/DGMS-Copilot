@echo off
echo Starting DGMS Copilot Backend...
cd /d "%~dp0"
call venv\Scripts\activate.bat
uvicorn main:app --reload --port 8000 --host 127.0.0.1
