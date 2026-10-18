# Real LLM scenario prototype

This Cloudflare Worker securely calls the OpenAI Responses API. It interprets a user's question into a validated *scenario intent*. It does not calculate supply-chain economics itself.

## Deploy

1. From this directory run `npx wrangler login`.
2. Run `npx wrangler secret put OPENAI_API_KEY` and enter the API key (never commit it).
3. Run `npx wrangler deploy`.
4. In `supply-chain-machine/index.html`, set `window.SCM_LLM_ENDPOINT = 'https://YOUR-WORKER.workers.dev/api/scenario'` before `model-editor.js`.

The site is static, so an API key must **never** be placed in the frontend. Worker has an origin check but is a public endpoint; before sharing widely, add authentication and rate limiting to avoid API abuse. The worker returns only an intent, explanation and assumptions. The existing deterministic cost engine must implement the scenario before reporting savings. The frontend currently previews intent only, without fabricating a scenario result.

Test prompt: "What if we add a warehouse in Reno, Nevada?" Follow-up: "What if it costs $50,000 a month?"
