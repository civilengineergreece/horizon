# HORIZON — Emergency rollback runbook (MVP 2026-11-27)

## Release architecture

The website is a **static GitHub Pages site built from repository root on main**. The live search API runs separately at `https://horizon-live-api.gnchristou.workers.dev` in Cloudflare Workers. All changes to the site appear only after Pages publishes the relevant `main` commit. The Worker can deploy on a separate Cloudflare pipeline; a Pages rollback does **not** automatically roll back the Worker.

**Last known-good pre–Stage 6:** `348565e99caa6adfb30fda1c5089523cf0cdb7c2` (Stage 5 email fail-closed, privacy/terms, external seller handoff). Published Pages check: [#45997917624](https://github.com/civilengineergreece/horizon/actions/runs/45997917624); published-site QA [#45997918365](https://github.com/civilengineergreece/horizon/actions/runs/45997918365). The specific Stage 6 release SHA must be recorded from the production merge after all checks pass.

**Never** delete/force-push `main`, change Cloudflare API tokens, publish private secrets, or run a booking/payment to validate a rollback.

## Triggers to roll back

1. Any public published-site Chrome regression involving trip dates, passengers, budget, downloadable PDF, map URLs, or unsafe booking/payment claims.
2. Google Flights/Hotels paid provider calls caused solely by loading the page or opening the planner.
3. Exposure of a secret or unrestricted email sending; in this case first **disable the affected secret / route** on Cloudflare then roll back; a site-only rollback does not stop Worker traffic.
4. Production errors that impact many users and cannot be fixed safely in a forward patch.

## Website rollback (safe, auditable)

1. Identify the exact public-bad `main` commit and its PR from GitHub Actions' Pages deployment; do not blindly revert older shared work.
2. Create a **revert PR** through GitHub's PR **Revert** action for the offending Stage 6 squash commit, or on a fresh branch created from current `main` use `git revert --no-edit <bad-squash-commit>`; do not reset or force-push. If other changes landed afterward, resolve conflicts and revert only the offending files.
3. Review the diff, especially `index.html`, `live-config.js`, PDF assets and privacy/terms: preserve the Stage 5 protections from `348565e`.
4. Run all syntax/unit/Chrome/release tests on the revert PR; merge only after passing. If an urgent incident makes CI unavailable, require explicit operator approval and document the missing tests.
5. Confirm the new Pages build and deployment is **success** and the published site has the old stable marker (or no Stage 6 marker); verify `https://civilengineergreece.github.io/horizon/`, `privacy.html`, `terms.html`, Greece-first smoke and PDF.
6. Confirm the API `/health`, `/flight-capabilities` and `/hotel-capabilities` without any billable provider search. Record SHA, deployment URL, test results, incident and follow-up PR.

Do not assume re-running an old GitHub Pages workflow will switch the published main branch content; publish a *new* commit that reverses the bad change.

## Worker rollback (only if API deployment is independently faulty)

1. Use Cloudflare Workers **Deployments / Versions** to locate the last verified version for `horizon-live-api`. Prefer Cloudflare's version rollback (if available) rather than changing credentials or restoring a local guessed build.
2. If Cloudflare version rollback is unavailable, create an audited PR restoring Worker files from a known-good commit **plus its compatible Wrangler configuration**, then manually dispatch `.github/workflows/deploy-live-api.yml` at that reviewed revision. The workflow currently checks out the selected ref and deploys with Cloudflare credentials from protected GitHub secrets. This step requires Cloudflare deploy permission.
3. Keep `EMAIL_PDF_ENABLED` disabled, confirm `/email-pdf` rejects invalid/no-origin requests, and preserve the signed Google seller handoff and query provenance boundaries.
4. Validate Worker non-billable health and then the published browser matrix; review provider quotas before any live search. Rollback may briefly cause stale frontend/API schema mismatch: verify compatibility explicitly.
5. Record the deployed Worker version, changes and operator actions. Never leak tokens in logs/issues.

## Verification matrix

| Check | Expected after revert |
| --- | --- |
| GitHub Pages build | Successful, correct known-good Git commit |
| Cloudflare Worker | Health/flight/hotel capability checks pass; no secret exposure |
| Planner | Five Greece-first results; same budget for same party on desktop/mobile |
| PDF | Real fillable summary + daily pages and map links |
| Provider outage | Clearly failed live lookup, no phantom supplier or purchased ticket |
| Email | Still disabled without full Turnstile/rate-limit/privacy activation |
| Partner checkout | External seller links only, no in-Horizon payment claim |

## Operational limits

This repository does not ship a one-click **automatic live rollback** because it would require deployment permissions and can otherwise erase later changes. This runbook is a tested-code restoration plan; no production rollback was executed or needed by writing it. GitHub Pages CDN caches may briefly serve older assets during propagation.
