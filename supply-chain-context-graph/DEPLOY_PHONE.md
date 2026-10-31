# Phone-first deployment

Architecture: GitHub Pages (static UI) -> Cloudflare Worker (private HF token) -> Hugging Face Inference Router.

## 1. GitHub Pages
Merge PR #5. In repository Settings > Pages, choose GitHub Actions as the source. The Pages workflow publishes the `supply-chain-context-graph/web` directory. Site URL should be https://frankruns.github.io/franksprotos/ (subject to repository settings).

## 2. Cloudflare Worker
In Cloudflare dashboard create a Worker named `supply-chain-context-graph`. Use the code in `worker/src/index.js` (dashboard editor), or deploy from the `worker` directory using Wrangler if a computer is available. Add a **secret** named `HF_TOKEN`, and set plain text variables `MODEL_ID=Qwen/Qwen3-4B-Instruct-2507` and `ALLOWED_ORIGIN=https://frankruns.github.io`. Do not paste the token in GitHub or the Pages UI.

## 3. Phone
Open the GitHub Pages site. Under Connection settings, paste your Worker HTTPS URL (not the token). Enter a company public URL, then Generate.

## Current limitations
- The Worker only fetches one HTML page. Many company homepages have little supply-chain evidence or block automated requests. For real Target benchmarking, add sourced investor/logistics pages and multi-source retrieval.
- The Worker currently embeds a **small** knowledge subset, not the full repository knowledge base. Connecting curated KB retrieval is pending.
- No authenticated live model call has been performed. Model availability, provider JSON mode, quota, and Cloudflare Worker CPU/time limits need verification.
- Browser Origin checks are not authentication. Public Worker endpoints can be called outside a browser. Add rate limiting and authentication before broad public launch.
- HTML extraction is crude; dynamic pages may fail. No private customer data.
- JSON schema validation is structural; citations are not semantic proof.
