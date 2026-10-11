@echo off
REM One-command start for Windows: creates a virtualenv on first run, installs the
REM dependencies, then launches Darkroom. Extra arguments are passed to app.py.
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment ^(.venv^)...
  python -m venv .venv || (echo Python 3.10+ is required: https://www.python.org/downloads/ & pause & exit /b 1)
  ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
)
".venv\Scripts\python.exe" -c "import fastapi, uvicorn, httpx, websockets, multipart, PIL" 2>nul || (
  echo Installing dependencies...
  ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
)
".venv\Scripts\python.exe" app.py %*
pause
