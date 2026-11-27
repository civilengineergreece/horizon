# HORIZON — 27/11/2026 MVP Release Readiness
> **Release status update (27/11/2026):** This baseline readiness assessment has been superseded by [the verified Stage 6 release notes](MVP_RELEASE_NOTES_2026-11-27.md), [rollback runbook](ROLLBACK_RUNBOOK_2026-11-27.md) and [four green published-site QA gates #46002319947](https://github.com/civilengineergreece/horizon/actions/runs/46002319947) on source release `19250335aa746db55a647650473da8fa97c6b76d`. Prior unchecked historical items in this document were prerequisites at its original creation, not the current release status; the *explicitly unresolved merchant checkout, email activation and legal risks* still apply.


**Target:** 30/11/2026. **Current branch baseline:** main commit 176b222f (20/11/2026).
This is an evidence-led readiness assessment, not a declaration of final release.

## Verified earlier
- Hotel family occupancy, real Google Hotels first+second page, room offer normalization,
  source timestamp and local climate fee caveat (see PRs #27–#38 and issue #15).
- Interactive Leaflet/OSM map for source-loaded hotels and filter/pagination behavior.
- Google Flights selection, outbound/return, seller quote, family passenger handling,
  quote freshness and budget replacement (see PRs #16–#31).
- November 20 GitHub Pages deployment succeeded. Published frontend and hotel/flight
  test jobs passed for the preceding code commit, but this is not a Nov 27 release test.
- On 20 Nov, production hotel test matrix passed: adults, 8-year-old child, infant,
  mixed family, plus rejections for unsupported multi-room and invalid occupancy;
  evidence in docs/live-hotel-matrix.json.

## Required fresh gates before accepting the candidate
- [ ] All JavaScript syntax and existing offline unit tests on current revision.
- [ ] Chrome flight UI, family hotel UI, price map, real Leaflet runtime integration.
- [ ] Five Greece-first trip cards on desktop and narrow mobile viewport.
- [ ] No-cost production Worker health, Google Flights / Hotels capability checks.
- [ ] Verify latest GitHub Pages deployment after merging changes to main.
- [ ] Verify all five scenarios manually for date flows, fees, budgets, maps/PDF.
- [ ] Verify car/ferry/train/bus **real-source** prices and timings where claimed;
      otherwise retain explicitly estimated / unsupported labels.
- [ ] Confirm GDPR/privacy, consent, accessibility and platform legal text before
      a commercial launch. No payment or booking should be represented as operational.
- [ ] Verify public email PDF endpoint is protected against abuse before enabling email.

## Explicit non-goals / unverified
- Provider offer is **not** final seller checkout, booked room or ticket.
- Infant cot availability and guest acceptance remain specific to room/date/provider.
- Unspecified climate levy/extra fee remains unknown; do not double-charge.
- Ferry, bus and train comparisons are estimates unless actual source verification exists.
- Real-time map does not mean all accommodation in a city was loaded.
- Premium/payment flow is a prototype and must remain disabled until completed.

## What this release QA change adds
A new PR/push/manual CI workflow that runs all offline unit tests; existing flight,
hotel and hotel map Chrome suites; a five-case desktop/mobile scoring and cost
smoke; and provider-quota-free production Worker health/capability checks.

A green build verifies only its explicit tests. It does not certify external checkout,
legal readiness, untested itinerary feasibility or complete Greece-wide transport coverage.
