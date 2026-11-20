# Security and data policy

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** button (Security → Advisories) on this repository. Do not open a public issue for a vulnerability. Include steps to reproduce and the affected URL or file. We aim to acknowledge reports within three working days.

Reports we care most about:

- Any way to sign a clinical decision without a clinician token (`record_decision`, the audit log).
- Prompt injection that makes an agent cite evidence it was not given, invent a trial ID or write a dose.
- Leakage of identifiers to the language model (the synthesis step must receive a pseudonymous ID and an age band only).
- Bypassing the rate limits on live Claude runs.
- Secrets in the repository or in build output.

## Supported versions

| Version | Supported |
|---|---|
| `main` (deployed at https://oncoagent.vercel.app) | Yes |
| Older commits | No |

## Data policy

- **No real patient data.** Every patient in this repository and in the live demo is fictional. Do not upload, paste or commit real health data, screenshots of real records or real molecular reports, even de-identified.
- **Secrets** live only in environment variables (`ANTHROPIC_API_KEY`, `CLINICIAN_TOKEN`, `MCP_BEARER_TOKEN`). `.env*` files are ignored by git and by the Vercel upload (`app/.vercelignore`).
- **Demo storage.** The demo keeps the audit log and live runs in the visitor's browser (`localStorage`). Production stores them server-side in an append-only table; see [docs/SAFETY.md](docs/SAFETY.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Hardening already in place

- HTTP security headers (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) in [`app/next.config.ts`](app/next.config.ts); the `x-powered-by` header is removed.
- `record_decision` over MCP refuses without the clinician token; an AI client cannot sign.
- Optional bearer token on the MCP HTTP endpoint (`MCP_BEARER_TOKEN`).
- Per-visitor rate limit on live Claude runs and a global limit on Claude runs through MCP ([`app/src/lib/ratelimit.ts`](app/src/lib/ratelimit.ts)).
- The safety-critic rejects unknown evidence IDs, trial IDs not returned by the registry and doses not produced by the calculator.
