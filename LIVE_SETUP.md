# HORIZON live API setup

The static site is published from the repository root on `main`:
https://civilengineergreece.github.io/horizon/

The production API is https://horizon-live-api.gnchristou.workers.dev.
`live-config.js` contains this public URL, never provider credentials.

## Active provider and routes

The Worker entry point is `worker/src/index-v6.js`; its delegated hotel routes
use Google Hotels through SerpApi. Google Flights also uses SerpApi.
The older Amadeus setup is not the active hotel integration.

- `GET /health`: provider configuration flags, without secret values.
- `GET /hotel-capabilities`: supported occupancy and search features.
- `GET` or `POST /stays`: live hotel search and pagination.
- `GET` or `POST /hotel-details`: property offers and available seller terms.

Children need their actual ages. Infants are sent separately as provider age 1.
This convention does not establish infant acceptance or cot availability.
Multi-room requests are rejected with `422 UNSUPPORTED_ROOM_COUNT`; do not
multiply a single-room quote and present it as verified multi-room availability.
Missing child ages and invalid occupancy are rejected before provider billing.

## Cloudflare Workers Builds

The connected repository deploys the Worker with root directory `worker`.
`npm run deploy` invokes `deploy-with-runtime-secret.mjs`.

Configure `SERPAPI_API_KEY` as a secret in Workers Builds build variables and
secrets. The deploy script passes it to Wrangler through a temporary secrets
file and removes that file afterwards. The deployed Worker must have the same
named runtime secret. `wrangler.jsonc` declares it as required and preserves
existing variables with `keep_vars: true`.

Do not paste secret values in chat, logs, frontend code, browser storage or Git.
Successful live searches verify that the runtime credential works; they do not
constitute an inventory or rotation audit of all account secrets.

## Alternative manual GitHub Actions deployment

`Deploy Horizon Live API` is a manually triggered workflow. It needs repository
secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. This workflow runs
Wrangler directly; provision the runtime `SERPAPI_API_KEY` in Cloudflare first.
Do not assume this path transfers a build secret into the Worker.

## Validation

Run offline regression tests from the repository root:

```sh
node --test tests/*.test.mjs worker/tests/*.test.mjs
```

Run the explicit production matrix when live checks are needed:

```sh
node worker/tests/live-hotel-matrix.mjs
```

This consumes provider quota for four valid searches. It uses dates 14–16 days
in the future and checks adults, a child, an infant, a combined family, invalid
occupancy, missing ages and unsupported rooms. It checks HTTP status, CORS,
occupancy, provider ages and non-empty priced results. Failures return a nonzero
exit code. The sanitized result is written to `docs/live-hotel-matrix.json`.
No seller checkout, reservation or payment is performed by this script.

## Price evidence

Catalog totals are quotes, not independently verified final checkout totals.
Unknown taxes, infant acceptance, cot availability and cot fees must remain
unknown unless explicitly confirmed. Separate mandatory charges must be added
once for all rooms and nights. Manual seller-checkout entry remains labeled as
user-reported, even when all required fields are complete.


## Paid-search abuse protection (independent audit, 27 Nov 2026)

The deployed entrypoint `src/index-v6.js` **fails closed** for all billable SerpApi lookups (`/flights`, `/flight-returns`, `/flight-booking-options`, `/stays`, `/hotel-details`). A configured `SERPAPI_API_KEY` alone does not permit direct unrestricted calls.

- Cloudflare Wrangler **must** deploy native `TRAVEL_SEARCH_RATE_LIMIT` from `worker/wrangler.jsonc` (12 requests / 60 seconds / edge source IP). Rate-limit key is the Cloudflare-supplied `CF-Connecting-IP`, never untrusted `X-Forwarded-For`. Only requests with the exact `ALLOWED_ORIGIN` may call paid endpoints; this is a browser abuse reduction, not authentication. Missing binding -> HTTP 503; exceeded -> HTTP 429; the supplier is not called.
- **No-cost verification:** open `GET https://horizon-live-api.gnchristou.workers.dev/search-protection-capabilities`. Expect `ok:true`, `guarded:true`, `rateLimitConfigured:true`, `perIpLimit:12`, `periodSeconds:60`. A successful GitHub build without this deployed response is insufficient.
- In GitHub Actions, the candidate PR is allowed to see the older Worker until merge; main production checks **wait for and require** the newly deployed binding without making paid searches.
- **Limit:** Cloudflare native limiting is per-point-of-presence / approximate, not a global monthly spend cap. Configure **account-wide SerpApi spending/usage alerts and maximum monthly budget**, Cloudflare WAF bot rules and monitoring before public promotion. An attacker using distributed IPs may still consume quota. A provider search may also make additional airport-resolution calls.
- Local development that calls the real Worker must use an explicitly configured origin in `ALLOWED_ORIGIN` on a separate development environment. The production site must not broaden origin checks to `*` or arbitrary localhost.

**Security runbook:** `docs/FULL_INDEPENDENT_AUDIT_2026-11-27.md`. This remains a free, non-transactional travel search app; bookings and merchant payments are external.
