# Security and data policy

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** button (Security → Advisories) on this repository. Do not open a public issue for a vulnerability. Include steps to reproduce and the affected URL or file. We aim to acknowledge reports within three working days.

Reports we care most about:

- Any way to reach a page or API without signing in, to act as another account, or to read another account's cases, runs or audit log.
- Any way to sign a clinical decision without a clinician session or token (`record_decision`, the audit log), or to edit or delete an audit entry.
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
- **Secrets** live only in environment variables (`AUTH_SECRET`, `AUTH_PASSWORD_HASH` / `AUTH_USERS`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `CLINICIAN_TOKEN`, `MCP_BEARER_TOKEN`). `.env*` files are ignored by git and by the Vercel upload (`app/.vercelignore`); [`app/.env.example`](app/.env.example) lists the names with no values.
- **Passwords** are never stored. Only scrypt hashes (`npm run hash-password`) are kept, in the environment, never in the repository.
- **Storage.** With `DATABASE_URL` set, cases, runs and the audit log are stored in PostgreSQL per account, and the audit table refuses updates and deletes at the database level. Without it they stay in the clinician's browser (`localStorage`), and the account menu says so. See [docs/SAFETY.md](docs/SAFETY.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Hardening already in place

- **Sign-in on every page and API.** [`app/src/proxy.ts`](app/src/proxy.ts) redirects to `/login` (pages) or answers 401 (API) without a valid session; route handlers check the session again before touching data. Public routes: `/login`, `/api/auth/*`, `/api/health`, and `/api/mcp` (which has its own check).
- **Session.** HS256-signed token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production), 12-hour lifetime; changing `AUTH_SESSION_VERSION` signs everyone out ([`app/src/lib/session.ts`](app/src/lib/session.ts)).
- **Passwords.** scrypt with a random salt, compared in constant time; unknown usernames cost the same time as known ones ([`app/src/lib/server/password.ts`](app/src/lib/server/password.ts), [`users.ts`](app/src/lib/server/users.ts)).
- **Lockout.** 10 failed sign-ins per IP and 20 per username in 15 minutes, then 429 with `retry-after`; a successful sign-in clears the counters.
- **The signer comes from the session.** Audit entries record the signed-in clinician; a name sent in the request body is ignored.
- **Per-account isolation.** Every storage query is filtered by the account that owns the row; tests check that one account cannot read another's data.
- **Append-only audit.** A PostgreSQL trigger rejects `UPDATE` and `DELETE` on `oa_audit`; entries are SHA-256 chained per account under an advisory lock.
- **Cross-site guard.** `POST`, `PUT`, `PATCH` and `DELETE` on `/api/*` with a foreign `Origin` are refused with 403, on top of `SameSite=Lax`.
- **MCP endpoint.** Needs `Authorization: Bearer <MCP_BEARER_TOKEN>` or a signed-in session. `record_decision` also needs `CLINICIAN_TOKEN`; an AI client cannot sign. Both tokens are compared in constant time.
- **HTTP headers** in [`app/next.config.ts`](app/next.config.ts): Content Security Policy (outside origins limited to the pinned Mol* build on jsDelivr and RCSB), `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`; `Cache-Control: no-store` on API answers; `x-powered-by` removed.
- **Rate limits.** Per-visitor limit on live Claude runs and a global limit on Claude runs through MCP ([`app/src/lib/ratelimit.ts`](app/src/lib/ratelimit.ts)).
- **Grounding checks.** The safety-critic rejects unknown evidence IDs, trial IDs not returned by the registry and doses not produced by the calculator.

## Known limits

- The CSP allows `'unsafe-inline'` and `'unsafe-eval'` scripts: Next.js needs inline bootstrap scripts and the Mol* viewer compiles code at run time. Self-hosting Mol* with nonces is on the roadmap.
- Accounts are configured in the environment. Hospital SSO with MFA and per-role permissions replace them before real use ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#8-production-hardening-checklist)).
- Rate-limit counters live in memory per server instance and reset on a cold start.
