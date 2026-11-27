# HORIZON MVP — staged closeout plan, 27 November 2026

**Release goal:** Greece-first FREE MVP by 30 Nov 2026. **Baseline:** main df1bc666 (PRs #39–#41), with public deployment and four successful QA gates. Issue #15 remains the source of truth.

| Priority | Stage | Definition of Done / evidence | Status |
| --- | --- | --- | --- |
| 1 | Editable itinerary and PDF | Edit → save → reopen; trip-scoped dates/party; valid daily budgets; create real PDF with 1 summary + N pages, Greek text, edit fields, map URLs; Chrome QA local and published | ✅ Complete — [PR #42](https://github.com/civilengineergreece/horizon/pull/42), [production CI #45981231076](https://github.com/civilengineergreece/horizon/actions/runs/45981231076) |
| 2 | Feasible time-and-family itinerary | Actual arrival/departure and check-in/out constraints, durations/transfers/POI opening hours where verified, infant and accessibility buffers; flag unknowns without inventing feasibility | Open |
| 3 | Greek ground/ferry/train/bus evidence | Real operators and route data where integrated, dates/passengers/vehicle/cabins/fees; fallback labelled as estimate; no phantom services/prices | Open |
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
