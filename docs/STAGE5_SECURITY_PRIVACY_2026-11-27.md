# HORIZON Stage 5 — security, privacy and email abuse gate (27 Nov 2026)

## Scope and implementation

The public site is still a static GitHub Pages app backed by a Cloudflare Worker for Google Flights, Google Hotels and travel search. No payment, seat hold, ticket or room reservation is claimed. Travel notes and planner budgets remain in browser localStorage; email/PDF are not sent by default.

### Verified security bug closed

Previously, `worker/src/index-v6.js` accepted arbitrary `POST /email-pdf` requests and would forward attacker-supplied PDF/email to Resend if `RESEND_API_KEY` was set. CORS is only a browser restriction and **does not stop scripts/curl**, so provider-key-only configuration would have created an email-spam relay.

New **fail-closed** requirements must ALL be present before any email delivery:
1. `EMAIL_PDF_ENABLED=true` (private/runtime config; disabled by default);
2. Worker secret `RESEND_API_KEY`;
3. Worker secret `TURNSTILE_SECRET_KEY` (server-side Cloudflare Turnstile verification; one-time/short-lived token, action `email_pdf`, hostname equal to configured production origin);
4. `EMAIL_FROM` set to a **verified, pure email address** that Resend allows (the old `onboarding@resend.dev` fallback is gone);
5. Cloudflare `EMAIL_PDF_RATE_LIMIT` binding provided by `worker/wrangler.jsonc`; configured at 3 requests/60 seconds per limit key at each Cloudflare location;
6. exact request `Origin` matches `ALLOWED_ORIGIN`; no local/no-origin bypass on production email;
7. JSON with a **non-prechecked explicit consent** `consent=true, consentVersion='2026-11-27'`, valid email, filename and PDF, bounded request body (<9 MB), `%PDF-` file signature and real Turnstile token;
8. `CF-Connecting-IP` present from Cloudflare edge; rate-limit by source IP **before** Turnstile and by SHA-256-hashed recipient **after** successful Turnstile.

No API keys, PDF body, email or Turnstile token are logged. The Worker returns generic error messages instead of reflecting Resend provider errors. Server and client do not store the email, PDF or Turnstile token in their own database/localStorage. The provider may retain delivery information under its own policy.

**Operational warning:** Cloudflare's Rate Limiting Worker binding is approximate and per data center, not a global atomic quota. Deploy WAF/rules and provider-level sending limits for broader production use. Configure Resend account limits and sender domain authentication; monitor provider abuse, bounced mails and alerts. No live outbound email is asserted until these protections, owner contact and written vendor data agreements are confirmed.

### Client operation

The itinerary editor displays an explicit optional consent checkbox and links to `privacy.html`. Turnstile script is loaded **only after the user deliberately requests email and when both public `emailPdfEndpoint` and `turnstileSiteKey` are configured**. The first click renders the verification; after the challenge, the user confirms the send. Each token is consumed/reset after attempting to send. Without live configuration, the page accurately says email delivery is unavailable and offers direct PDF download. The response says only **accepted by email provider**, not guaranteed to have reached the inbox.

Public configuration: `window.HORIZON_LIVE_CONFIG.emailPdfEndpoint` and `.turnstileSiteKey` must only be supplied after full production readiness; the site key is public, never the secret.

### Privacy and terms

- Public Greek `privacy.html` discloses local browser storage, travel-search provider data, optional email-PDF and Turnstile, external seller checkout, and third-party technical processing. `terms.html` explains quote/booking/payment limits.
- Both links are visible in the site footer; the optional email flow links directly to the disclosure.
- These pages are **operational notices, NOT certified final GDPR compliance**. The operating controller's verified legal name, contact address for data-subject rights, supplier DPA/cross-border assessment and actual retention periods are NOT supplied. Email stays disabled and commercial/processing launch remains blocked pending those human/legal steps.
- Do not invent contacts, retention periods, refund rights, or vendor contracts. Independent legal/privacy review is still required.

### Deploy and acceptance checklist

- [x] Unit: without all env flags, no email is sent (even if Resend key exists); forged/missing origin rejected
- [x] Unit: explicit consent, valid PDF size/signature, valid token/action/hostname, per-IP and per-recipient limits, generic provider error
- [x] Browser: first-visit consent unchecked, public disclosure pages load, disabled email cannot contact a third party or load Turnstile
- [ ] Real email delivery smoke: requires verified sender, keys, Turnstile site key and rate limiting on production; **no secrets or billed sends as CI fixtures**
- [ ] Owner legal contact and vendor data handling review: requires human-supplied verified information
- [ ] Advanced WAF, abuse monitoring, global volume limiting: operational follow-up

### Referenced vendor manuals

- Cloudflare server-side Turnstile verification: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare Workers rate-limit binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Vendor sender docs: https://resend.com/docs

**Verdict:** Safe free-MVP public boundary can ship with email **disabled by default**; protected email send is implemented behind configuration and tested with mocks, but not live-verified or legally launch-ready. The commercial/travel checkout remains external and unverified.
