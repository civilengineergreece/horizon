# HORIZON MVP — staged closeout plan, 27 November 2026

**Release goal:** Greece-first FREE MVP by 30 Nov 2026. **Baseline:** main df1bc666 (PRs #39–#41), with public deployment and four successful QA gates. Issue #15 remains the source of truth.

| Priority | Stage | Definition of Done / evidence | Status |
| --- | --- | --- | --- |
| 1 | Editable itinerary and PDF | Edit → save → reopen; trip-scoped dates/party; valid daily budgets; create real PDF with 1 summary + N pages, Greek text, edit fields, map URLs; Chrome QA local and published | ✅ Complete — [PR #42](https://github.com/civilengineergreece/horizon/pull/42), [production CI #45981231076](https://github.com/civilengineergreece/horizon/actions/runs/45981231076) |
| 2 | Feasible time-and-family itinerary | Selected-flight arrival/return windows where trip-matched; optional manual transport/check-in/out; conservative family and accessibility buffers; flag impossible slots and explicitly unverified POI hours/travel durations | ✅ Guarded MVP complete — [PR #43](https://github.com/civilengineergreece/horizon/pull/43), [PR #44](https://github.com/civilengineergreece/horizon/pull/44), [production CI #45982938840](https://github.com/civilengineergreece/horizon/actions/runs/45982938840) |
| 3 | Greek ground/ferry/train/bus evidence | Grounded source routes where available; per-option vs family fare safety, source/date validation, no phantom bus or vehicle checkout; estimates explicitly disclosed | ✅ Guarded MVP complete — [PR #45](https://github.com/civilengineergreece/horizon/pull/45), [published Chrome QA #45988073949](https://github.com/civilengineergreece/horizon/actions/runs/45988073949); missing providers/real checkout remain open |
| 4 | Final seller checkout integration | Source quote + seller total, room/bed, dates, child/infant occupancy/cot, cancellation/taxes, carrier ancillary fees; distinguish manually reported checkout from verified transaction | Open |
| 5 | Security/privacy and commercial gating | No public secrets; protected outbound email against abuse; privacy/terms and consent review; no active payment/booking claim without verified end-to-end production flow | Open |
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
