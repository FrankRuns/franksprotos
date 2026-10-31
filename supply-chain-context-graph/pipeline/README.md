# Open-weight LLM adapter (not yet deployed)

The pipeline supports an OpenAI-compatible chat-completions endpoint with JSON output.

Example local vLLM endpoint configuration:

```bash
export SCG_LLM_BASE_URL=http://localhost:8000/v1
export SCG_LLM_MODEL=YOUR_MODEL_ID
export SCG_LLM_API_KEY=YOUR_TOKEN_IF_REQUIRED
```

Import `build_messages` from `build_prompt.py` and pass the result to `generate_json` in `llm_client.py`.

The adapter has not been run against a live model. Provider support for `response_format` varies. Next steps: connect an endpoint, validate output against the graph schema, record latency/token usage and benchmark evidence-only vs knowledge-augmented generation. Avoid sending private customer data to unapproved endpoints.
