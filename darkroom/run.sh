#!/usr/bin/env sh
# One-command start for macOS / Linux: creates a virtualenv on first run, installs
# the dependencies, then launches Darkroom. Any extra arguments are passed to app.py
# (e.g. ./run.sh --comfy http://127.0.0.1:8188 --port 8585).
set -e
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  echo "Creating virtual environment (.venv)..."
  python3 -m venv .venv
  .venv/bin/python -m pip install --quiet --upgrade pip
fi
if ! .venv/bin/python -c "import fastapi, uvicorn, httpx, websockets, multipart, PIL" 2>/dev/null; then
  echo "Installing dependencies..."
  .venv/bin/python -m pip install --quiet -r requirements.txt
fi
exec .venv/bin/python app.py "$@"
