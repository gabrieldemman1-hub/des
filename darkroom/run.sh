#!/usr/bin/env sh
# One-command start for macOS / Linux: creates a virtualenv on first run, installs
# the dependencies, then launches Darkroom. Any extra arguments are passed to app.py
# (e.g. ./run.sh --comfy http://127.0.0.1:8000 --port 8585).
set -e
cd "$(dirname "$0")"
# Prefer a well-supported Python when several are installed (newest releases can lack prebuilt packages).
PY=""
for candidate in python3.13 python3.12 python3.11 python3.14 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    PY="$candidate"; break
  fi
done
if [ -z "$PY" ]; then
  echo "Darkroom needs Python 3.10 or newer; 'python3' here is: $(python3 --version 2>&1 || echo missing)."
  echo "Install one from https://www.python.org/downloads/ (or: brew install python), delete .venv if it exists, and run this again."
  exit 1
fi
if [ ! -x .venv/bin/python ]; then
  echo "Creating virtual environment (.venv) with $PY..."
  "$PY" -m venv .venv
  .venv/bin/python -m pip install --quiet --upgrade pip
fi
if ! .venv/bin/python -c "import fastapi, uvicorn, httpx, websockets, multipart, PIL" 2>/dev/null; then
  echo "Installing dependencies..."
  .venv/bin/python -m pip install --quiet -r requirements.txt
fi
exec .venv/bin/python app.py "$@"
