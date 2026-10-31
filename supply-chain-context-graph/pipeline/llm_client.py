"""OpenAI-compatible client for open-weight models served by vLLM, Ollama-compatible proxies, or hosted endpoints.

Set SCG_LLM_BASE_URL, SCG_LLM_MODEL, and optionally SCG_LLM_API_KEY.
No GPU or provider account required to import this module.
"""
import json
import os
from urllib.request import Request, urlopen

def generate_json(messages, *, base_url=None, model=None, api_key=None, timeout=90):
    base_url = (base_url or os.getenv("SCG_LLM_BASE_URL", "")).rstrip("/")
    model = model or os.getenv("SCG_LLM_MODEL", "")
    api_key = api_key if api_key is not None else os.getenv("SCG_LLM_API_KEY", "")
    if not base_url or not model:
        raise ValueError("Configure SCG_LLM_BASE_URL and SCG_LLM_MODEL")
    url = base_url + "/chat/completions"
    payload = json.dumps({"model": model, "messages": messages, "temperature": 0, "response_format": {"type": "json_object"}}).encode()
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = "Bearer " + api_key
    req = Request(url, data=payload, headers=headers, method="POST")
    with urlopen(req, timeout=timeout) as response:
        data = json.load(response)
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)
