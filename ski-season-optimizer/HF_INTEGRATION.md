# Ski feedback integration deployment

The ski app at https://franksprotos.com/ski-season-optimizer/ calls:
`https://supply-chain-context-graph.ticketwitness.workers.dev/ski-feedback`.

## Deploy the existing Cloudflare Worker
The GitHub source was updated at `supply-chain-context-graph/worker/src/index.js`. This does **not** automatically deploy the Worker unless Cloudflare is already configured for GitHub-based deployment.

In the Cloudflare dashboard, open Workers & Pages → `supply-chain-context-graph`. Deploy the current repository version of `worker/src/index.js` and its existing `ontology.js` import, using the existing Wrangler configuration and bindings. Alternatively, from the `supply-chain-context-graph/worker` directory run `npx wrangler deploy` in an authenticated environment.

Preserve the existing `HF_TOKEN` secret, `MODEL_ID`, `ALLOWED_ORIGIN=https://franksprotos.com`, and Durable Object bindings. Never paste `HF_TOKEN` into the ski website.

## Test
1. Open the ski app, enter: “Ski Magic Mountain both Saturday and Sunday the third weekend in February.”
2. Click Apply and replan. The request must reach the Worker, and Qwen should return `{"action":"lock_weekend","resort":"Magic Mountain","month":2,"weekend_ordinal":3,"days":2,...}`.
3. Confirm the calendar includes February 20–21, 2027, both at Magic Mountain.
4. Confirm the optimization status says `MIP:` and not `MIP solver unavailable`. The GLPK loader was changed to an ES-module import, but must be browser-tested.
5. Verify the lodging nights and total cost changed as expected.

**Limitations:** Currently only one resort for a named two-day weekend is supported; requests to remove constraints, express preferences, or add arbitrary mathematical constraints are not yet implemented. The Worker endpoint has Origin restrictions but no real user authentication, so add rate limits/authentication before broad public access.
