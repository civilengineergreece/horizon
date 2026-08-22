# Horizon Live API setup

The public Horizon site is hosted on GitHub Pages, so private API credentials must never be placed in `index.html`, `live-api.js`, repository files, or browser storage.

The repository now contains a Cloudflare Worker under `worker/` that safely proxies three live services:

- `POST /road` → TollGuru road routing, tolls and route costs.
- `POST /flights` → Amadeus Flight Offers Search.
- `POST /hotels` → Amadeus Hotel List + Hotel Search v3.
- `GET /health` → shows which providers are configured.

## 1. Cloudflare Worker

Create a free Cloudflare account and enable Workers. The free Workers plan is enough for development and early testing.

Two deployment options are supported:

### Option A — Cloudflare Workers Builds

Import the GitHub repository `civilengineergreece/horizon` in Cloudflare Workers & Pages and set the Worker root directory to `worker`.

### Option B — GitHub Actions

Add these repository secrets in GitHub Settings → Secrets and variables → Actions:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Then run the `Deploy Horizon Live API` workflow manually from GitHub Actions.

Do not paste these secret values into chat or commit them to the repository.

## 2. TollGuru

Create a TollGuru developer account and obtain an API key. In the deployed Cloudflare Worker add this as an encrypted Worker secret:

- `TOLLGURU_API_KEY`

The Worker sends origin/destination addresses directly to TollGuru and normalizes route distance, duration, toll costs and toll locations. Horizon computes fuel locally from the user's L/100 km value so the selected consumption is always respected.

## 3. Amadeus

Create an Amadeus for Developers application. Add the following as encrypted Cloudflare Worker secrets:

- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`

During initial testing `worker/wrangler.jsonc` uses `AMADEUS_ENV = test`. For real live production offers change this to `production` after production access/credentials are enabled.

The same Amadeus credentials power both flights and hotels.

## 4. Connect the Worker URL to Horizon

After deployment Cloudflare provides a URL similar to:

`https://horizon-live-api.<your-workers-subdomain>.workers.dev`

Put that public URL (not a secret) into `live-config.js` as `apiBase`.

## Safety

Never commit API keys, OAuth client secrets, Cloudflare API tokens, passwords or payment credentials. All provider credentials belong in Cloudflare Worker Secrets (or GitHub Actions Secrets only when needed for CI deployment).
