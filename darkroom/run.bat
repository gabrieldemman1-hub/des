@echo off
REM One-command start for Windows: creates a virtualenv on first run, installs the
REM dependencies, then launches Darkroom. Extra arguments are passed to app.py
REM (e.g. run.bat --comfy http://127.0.0.1:8000).
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" goto :deps

REM Pick a Python: prefer well-supported versions when several are installed
REM (the newest release can lack prebuilt packages for some libraries).
set "PY="
for %%v in (3.13 3.12 3.11 3.14 3.10) do (
  if not defined PY ( py -%%v -c "import sys" >nul 2>nul && set "PY=py -%%v" )
)
if not defined PY ( py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul && set "PY=py -3" )
if not defined PY ( python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul && set "PY=python" )
if not defined PY (
  echo Darkroom needs Python 3.10 or newer. Install it from https://www.python.org/downloads/
  echo and tick "Add python.exe to PATH" in the installer, then run this again.
  pause
  exit /b 1
)
echo Creating virtual environment ^(.venv^) with %PY%...
%PY% -m venv .venv || (echo Could not create the virtual environment. & pause & exit /b 1)
".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip

:deps
".venv\Scripts\python.exe" -c "import fastapi, uvicorn, httpx, websockets, multipart, PIL" 2>nul || (
  echo Installing dependencies...
  ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt || (
    echo.
    echo Installing failed. If pip said "Building wheel ... did not run successfully", your Python is
    echo newer than the libraries support: install Python 3.13 from https://www.python.org/downloads/,
    echo delete the .venv folder next to this file, and run this again.
    pause
    exit /b 1
  )
)
".venv\Scripts\python.exe" app.py %*
pause
