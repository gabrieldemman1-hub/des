"""A fake OpenAI-compatible chat server (what Ollama / LM Studio expose) for tests.

    python dev/mock_llm.py --port 11434

Deterministic: the "expanded prompt" is the user's last line wrapped in a fixed
sentence frame, so tests can assert on it.  Special words in the user prompt:

* ``REFUSE``  -> the model answers with a refusal, like a safety-tuned model would
* ``SHORT``   -> a one-word answer (Darkroom should fall back to the rules)
* ``THINK``   -> the answer is wrapped in <think>...</think> reasoning tags
* an image part in the message -> the answer mentions ``[image seen]``
"""
from __future__ import annotations

import argparse
import time
from typing import Any

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def create_mock_llm(model: str = "mock-llm:7b", *, vision: bool = False) -> FastAPI:
    app = FastAPI()
    app.state.calls: list[dict[str, Any]] = []
    name = model if not vision else model.replace("llm", "vl")

    @app.get("/v1/models")
    async def models():
        return {"object": "list", "data": [{"id": name, "object": "model", "owned_by": "mock"}]}

    @app.get("/api/tags")
    async def tags():
        return {"models": [{"name": name}]}

    def answer_for(body: dict[str, Any]) -> tuple[str, bool]:
        msgs = body.get("messages") or []
        last = msgs[-1] if msgs else {}
        content = last.get("content", "")
        saw_image = bool(last.get("images"))  # Ollama native shape
        if isinstance(content, list):  # OpenAI content parts
            texts = []
            for part in content:
                if part.get("type") == "text":
                    texts.append(part.get("text", ""))
                elif part.get("type") == "image_url":
                    saw_image = True
            content = "\n".join(texts)
        return content, saw_image

    @app.post("/api/chat")
    async def ollama_chat(request: Request):
        """Ollama's native endpoint (what Darkroom uses when it detects Ollama)."""
        body = await request.json()
        app.state.calls.append(body)
        if body.get("model") not in (name, None, ""):
            return JSONResponse({"error": f"model '{body.get('model')}' not found"}, status_code=404)
        content, saw_image = answer_for(body)
        answer = make_answer(content, saw_image)
        return {"model": name, "created_at": "2026-10-11T00:00:00Z", "message": {"role": "assistant", "content": answer}, "done": True, "done_reason": "stop",
                "total_duration": 1000000, "load_duration": 1000, "eval_count": len(answer.split()), "eval_duration": 900000}

    @app.post("/v1/chat/completions")
    async def chat(request: Request):
        body = await request.json()
        app.state.calls.append(body)
        if body.get("model") not in (name, None, ""):
            return JSONResponse({"error": {"message": f"model '{body.get('model')}' not found", "type": "api_error"}}, status_code=404)
        content, saw_image = answer_for(body)
        answer = make_answer(content, saw_image)
        return {
            "id": "chatcmpl-mock",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": name,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": answer}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 100, "completion_tokens": len(answer.split()), "total_tokens": 100 + len(answer.split())},
        }

    def make_answer(content: str, saw_image: bool) -> str:
        user_prompt = content.split("User prompt:")[-1].split("Rewritten prompt:")[0].strip() if "User prompt:" in content else content.strip()
        if "REFUSE" in user_prompt:
            answer = "I'm sorry, but I can't help with that request."
        elif "SHORT" in user_prompt:
            answer = "Okay."
        elif saw_image and "Describe this photo" in content:
            answer = "[image seen] A woman in her thirties sits on a bed in soft window light, three-quarter framing."
        else:
            answer = (
                f"A woman in her thirties, {user_prompt.rstrip('.')}. She moves slowly and deliberately, then pauses and looks "
                "toward the lens, then settles back with a small smile. The camera holds a steady medium shot at eye level with "
                "a gentle push-in. Soft window light from the left, warm skin tones, shallow depth of field. Quiet room tone. "
                "Photorealistic footage, high detail, stable identity throughout, smooth natural motion."
            )
            if "image" in content.lower() and "reference image is supplied" in content:
                answer = "Starting from the pose in the reference image, " + answer[0].lower() + answer[1:]
        if "THINK" in user_prompt:
            answer = "<think>planning the shot list...</think>\n" + answer
        return answer

    return app


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=11434)
    ap.add_argument("--vision", action="store_true")
    a = ap.parse_args()
    uvicorn.run(create_mock_llm(vision=a.vision), host="127.0.0.1", port=a.port, log_level="warning")
