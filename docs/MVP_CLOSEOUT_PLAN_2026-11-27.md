# HORIZON MVP — staged closeout plan, 27 November 2026

**Release goal:** Greece-first FREE MVP by 30 Nov 2026. **Baseline:** main df1bc666 (PRs #39–#41), with public deployment and four successful QA gates. Issue #15 remains the source of truth.

| Priority | Stage | Definition of Done / evidence | Status |
| --- | --- | --- | --- |
| 1 | Editable itinerary and PDF | Edit → save → reopen; trip-scoped dates/party; valid daily budgets; create real PDF with 1 summary + N pages, Greek text, edit fields, map URLs; Chrome QA local and published | ✅ Complete — [PR #42](https://github.com/civilengineergreece/horizon/pull/42), [production CI #45981231076](https://github.com/civilengineergreece/horizon/actions/runs/45981231076) |
| 2 | Feasible time-and-family itinerary | Selected-flight arrival/return windows where trip-matched; optional manual transport/check-in/out; conservative family and accessibility buffers; flag impossible slots and explicitly unverified POI hours/travel durations | ✅ Guarded MVP complete — [PR #43](https://github.com/civilengineergreece/horizon/pull/43), [PR #44](https://github.com/civilengineergreece/horizon/pull/44), [production CI #45982938840](https://github.com/civilengineergreece/horizon/actions/runs/45982938840) |
| 3 | Greek ground/ferry/train/bus evidence | Grounded source routes where available; per-option vs family fare safety, source/date validation, no phantom bus or vehicle checkout; estimates explicitly disclosed | ✅ Guarded MVP complete — [PR #45](https://github.com/civilengineergreece/horizon/pull/45), [published Chrome QA #45988073949](https://github.com/civilengineergreece/horizon/actions/runs/45988073949); missing providers/real checkout remain open |
| 4 | Final seller checkout integration | Source quote + seller total, room/bed, dates, child/infant occupancy/cot, cancellation/taxes, carrier ancillary fees; distinguish manually reported checkout from verified transaction | 🟡 Partial — manual review [PR #46](https://github.com/civilengineergreece/horizon/pull/46) + actual provider-supplied Google Flights seller GET/POST handoff and labelled Google Hotels room-rate links [PR #47](https://github.com/civilengineergreece/horizon/pull/47); **merchant final-price API, ticket/payment and booked room remain unverified/unavailable** |
| 5 | Security/privacy and commercial gating | No public secrets; protected outbound email against abuse; privacy/terms and consent review; no active payment/booking claim without verified end-to-end production flow | 🟡 Technical guarded MVP — secure email relay implemented fail-closed, opt-in and disclosures added; **requires live provider/Turnstile configuration, controller contact and legal/vendor review**. [Stage 5 evidence](STAGE5_SECURITY_PRIVACY_2026-11-27.md) |
| 6 | Final release + rollback | Full offline/Chrome/public QA green, 5 Greece-first sample journeys, mobile/desktop PDF/route/budget smoke, release notes and explicit known limitations | Open |

## Non-negotiable
- Quotes aren't tickets or booked rooms.
- No third-party provider calls unless necessary, quotas checked.
- No secrets or personal traveler details in commits or logs.
- Do not mark missing API/provider capabilities as complete merely because UI mocks pass.
- Each stage closes only after green CI and evidence is written to issue #15.

## Stage 1 acceptance result — 27 Nov 2026

- Merged PR #42 (`2f16295c`), successful [GitHub Pages release #45981230945](https://github.com/civilengineergreece/horizon/actions/runs/45981230945).
- **Production** CI `#45981231076`: four of four checks passed. Chrome on the actual published site created and re-opened a PDF with Greek fields, a summary page plus three daily pages, saved editable itinerary, checked budget/party/date isolation, and rejected invalid daily amounts.
- Browser tests use synthetic travel inputs and do not verify actual POI opening times, supplier checkout or payment. These remain separate milestones.

## Stage 2 acceptance result — 27 Nov 2026

- Merged [PR #43](https://github.com/civilengineergreece/horizon/pull/43) (`78397d3`) and [PR #44](https://github.com/civilengineergreece/horizon/pull/44) (`0d3b6ac`). [Final Pages deployment #45982937880](https://github.com/civilengineergreece/horizon/actions/runs/45982937880) **SUCCESS**.
- Four final production gates **PASS** in [main QA #45982938840](https://github.com/civilengineergreece/horizon/actions/runs/45982938840); real published-site Chrome proves desktop 1280 and mobile 390 timing, editable PDF, family/infant and optional accessibility buffers, exact flight trip matching, local override, valid check-in/out warnings, rejected impossible or malformed times, and no booking.
- First/last day suggestions no longer invent clock times. A matching **selected offer** can supply supplier-reported arrival/return times, but it is NOT a booked ticket. For other modes users can enter times manually. Planning buffers are assumptions, not empirically measured transit duration.
- **Stage limit:** The inspector prevents obvious timetable conflicts but does not independently verify attraction opening hours, road/transit duration between points, confirmed accessibility or accommodation check-in. All these unknowns remain explicitly visible, including in the fillable PDF. The overall MVP is not certified as a commercial end-to-end booking product.

## Stage 3 guarded MVP acceptance — 27 Nov 2026

- Merged [PR #45](https://github.com/civilengineergreece/horizon/pull/45) (`298e4f5`), successful [GitHub Pages deployment #45988071102](https://github.com/civilengineergreece/horizon/actions/runs/45988071102), and **4/4 green** production gates [#45988073949](https://github.com/civilengineergreece/horizon/actions/runs/45988073949).
- Real published-site Chrome tests at **1280px desktop + 390px mobile** proved ferry individual starting fares do not overwrite group round-trip estimates; separate out/return quotes, malicious vendor markup/links are not injected; rail feed rider fares remain separate from family estimate; KTEL clearly says there is no connected live provider; non-Athens car origin never inherits Athens-only kilometres, fuel cost or tolls. Earlier flight/hotel/map/PDF/feasibility suites remain green.
- Worker unit tests mock Ferryhopper MCP and Transitous/MOTIS, reject invalid/inverted dates, phantom price-only trips, wrong-day routes, mixed rail/bus routes and ambiguous child fares. No supplier quota or booking/payment was incurred by test runs.
- **External services not independently validated by these tests**: real ferry operator quote with actual adults/children/infant/vehicle/cabin, live public-transport coverage/KTEL, actual multi-leg rail fare, full road routing/toll data from arbitrary origins, independently verified merchant checkout and ticket issuance. These remain *not implemented or unverified* and must never be shown as guaranteed. See [Stage 3 source matrix](GREEK_TRANSPORT_EVIDENCE_2026-11-27.md).

## Stage 4 manual checkout gate — 27 Nov 2026 (partial, not complete)

- [PR #46](https://github.com/civilengineergreece/horizon/pull/46) merged (`7bc50e7`): added user-reported *airline* final-screen checkout, on top of existing guarded hotel final-screen audit. It requires a named seller quote matched to the exact trip and party, fresh within 30 minutes, plus adult/child/infant seat/lap/fare, flight numbers/times/dates, seats/baggage, fees/taxes, cancellation and availability reviews. Missing fields cannot replace the budget quote.
- The user-entered airline all-in seller amount **replaces** the supplier quote and old separately estimated baggage, so prior baggage is never added twice; separately budgeted ground transfer is added once and remains an estimate unless individually verified. A changed fare or manually edited extras invalidates the recorded user audit. The record remains `checkout_user_reported_not_booked`, not independently verified.
- Browser/Node tests: strict invalid input and stale record validation, selected seller matching, no fake infant fee and no duplicate bag/crib/climate charges; mobile 390px form, older flight/hotel/map/PDF smoke. [Candidate CI #45989724065](https://github.com/civilengineergreece/horizon/actions/runs/45989724065) all available jobs green. [Production deployment/QA #45989921842](https://github.com/civilengineergreece/horizon/actions/runs/45989921842) tracked separately.
- **Cannot mark Stage 4 fully done:** no direct contract/partner access to an airline/hotel seller's real checkout API, no verified seller payment screen, no hold/ticket/booking/payment capability, and no controlled end-to-end refund/terms tests. These are external provider dependencies and must stay disclosed. [Evidence details](SELLER_CHECKOUT_PROVENANCE_2026-11-27.md).

## Stage 4 provider-to-seller handoff — 27 Nov 2026 (implemented redirect, checkout remains external)

- [PR #47](https://github.com/civilengineergreece/horizon/pull/47) merged (`522ad65`). The existing Google Flights Booking Options API now supports **source-provided** seller handoffs: HTTPS GET when given, or native browser POST of opaque Google Flights `booking_request.post_data` to the Google-owned `/travel/clk/f` redirect. Missing requests do NOT create fake links. For separate tickets, departure and return require separate supplier processes.
- Browser tests validate an explicit click (no automatic redirect), signed POST method/field preservation, exact GET destination, trip/date/party freshness gating and external-only action; Worker unit tests reject unsafe POST destinations and phantom links. **No payment, booking, or ticket is created**.
- For Google Hotels, a room-specific rate link is distinguished from a fallback seller/property link; neither is guaranteed to preserve price, bed, infant cot or room availability at checkout.
- The Cloudflare Worker and GitHub Pages deployment must pass release CI (including non-billable production `/flight-capabilities` v4 and desktop/mobile published Chrome tests) before declaring the deployed handoff ready.
- **Outstanding commercial integration:** Independent merchant-priced total inclusive of child/infant/ancillaries, seller inventory hold, payment, PNR/ticket/reservation and support/refunds need suitable partner booking API and credentials. Do not equate opening an external seller page with a confirmed transaction. [Technical source and safety details](SELLER_HANDOFF_INTEGRATION_2026-11-27.md).

## Stage 5 guarded-MVP security gate — 27 Nov 2026

- Backend email PDF route rejects unprotected sends even when a Resend API secret exists; requires explicit enabled flag, server-side Turnstile action/hostname validation, exact origin, PDF content validation, email consent and per-IP/hashed-recipient rate-limits. No provider details or secrets returned in errors.
- Itinerary editor exposes **unselected** email consent and links to Greek privacy and terms; challenge loads on demand only if configured, direct PDF stays free. No marketing consent or booked/purchased claim.
- Static site footer publishes `privacy.html` and `terms.html`; no false claim of full GDPR compliance. **Open legal/commercial gates**: identify controller/contact, define processor DPA/retention, set legitimate email sender + Turnstile secrets/site key, review WAF/global abuse controls and execute an authorized live email test.
- [Technical and legal limitations](STAGE5_SECURITY_PRIVACY_2026-11-27.md). GitHub Pages/Cloudflare worker green CI evidence recorded in issue #15 after deployment.
