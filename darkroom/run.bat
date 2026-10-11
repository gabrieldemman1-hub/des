@echo off
REM One-command start for Windows: creates a virtualenv on first run, installs the
REM dependencies, then launches Darkroom. Extra arguments are passed to app.py
REM (e.g. run.bat --comfy http://127.0.0.1:8000).
cd /d "%~dp0"
set "PY=python"
where py >nul 2>nul && set "PY=py -3"
if not exist ".venv\Scripts\python.exe" (
  %PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" 2>nul || (
    echo Darkroom needs Python 3.10 or newer. Install it from https://www.python.org/downloads/
    echo and tick "Add python.exe to PATH" in the installer, then run this again.
    pause
    exit /b 1
  )
  echo Creating virtual environment ^(.venv^)...
  %PY% -m venv .venv || (echo Could not create the virtual environment. & pause & exit /b 1)
  ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
)
".venv\Scripts\python.exe" -c "import fastapi, uvicorn, httpx, websockets, multipart, PIL" 2>nul || (
  echo Installing dependencies...
  ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
)
".venv\Scripts\python.exe" app.py %*
pause
