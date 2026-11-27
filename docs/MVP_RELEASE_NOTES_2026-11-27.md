# HORIZON FREE MVP — release notes, 27 November 2026

**Release scope:** Greece-first travel-planning MVP, published from `main` on GitHub Pages, with a separate Cloudflare Worker for travel data. This document distinguishes **tested source behavior** from seller-controlled transaction state.

## Included in the free MVP

- 150+ destination matching and Greek-first suggestions using budget, departure, duration, party, transport, destination type, interests and accommodation preferences. All matching scores and generic per-day budgets are **estimates**, not final sale prices.
- Editable itineraries, three-day sample plans, notes, manual daily budget low/high, client-side local persistence keyed by trip dates/party, and actual downloadable fillable PDFs with summary, daily pages and route/map links.
- Conservative timing guard for first/last days, selected source flight arrivals/departures, editable manual start/end times, family/infant and accessibility buffers. Unknown travel times/POI opening hours remain **explicitly unknown**.
- Ferry, rail, KTEL, car and flight hints scoped to actual source evidence, with separate rider vs family fares, date validation, transport availability caveats, and no fabricated provider quotes.
- Google Flights provider-specific seller quote and source-returned GET or signed POST **external handoff**, with separate-ticket legs shown independently. Google Hotels room-rate vs generic seller links distinguished. Seller confirms actual price, inventory, infant/child charges, cot, climate levy, cancellation, baggage and final booking/payment.
- Optional airline/hotel *user-reported* seller last-screen audits; not a verified purchase/PNR/receipt. Separate baggage/ground charge double-count prevention.
- Public Greek [privacy notice](../privacy.html) and [usage terms](../terms.html). Secure email PDF relay is implemented but **disabled by default**, pending protected provider keys, verified sender/Turnstile, documented controller contact and data processing review. Direct PDF remains available without email.

## Stage 6 release quality gates

**Public acceptance matrix** to be validated against exact release revision:

1. Five Greece-first journeys in Chrome **1280px desktop + 390px mobile**: Thessaloniki (2 adults + infant, air), Nafplio (2 adults + child, car), Syros (2 adults, ferry), Ioannina (1 adult, car), Rhodes (2 adults + child + infant, air). For every case: source destination card, bounded nonnegative EUR budget, editable three-day itinerary, **real four-page fillable PDF**, and a valid `map.html` link with corresponding daily stops.
2. Provider outage emulation: block all live API calls and confirm flight/hotel panels show explicit failure, create no phony offers/bookings, and the personal itinerary/real PDF remain accessible.
3. Existing regression suites: flight seller checkout redirect, hotel rooms/infant/cot/taxes, interactive hotel map, rail/ferry/KTEL/car source labels, itinerary feasibility/PDF and security/consent.
4. Static published-site version marker `horizon-mvp-release=2026-11-27-stage6`, with browser checks against both exact local candidate and the **actually published** GitHub Pages site.
5. All Worker unit tests and non-billable production health. No test creates a live booking or sends email.

**Important distinction:** A Green published-site test demonstrates mocked-provider UI, real browser/PDF generation and safe labels, **not** authenticated live seller inventory, payment or a room/ticket purchase.

## Known limitations and non-goals

- Airline/hotel checkout cannot be independently completed or confirmed without an authorized merchant/OTA partnership/booking API. Final seller price can change, especially for infants, cot, beds, cabin/baggage and local taxes.
- KTEL is not represented as a live connected ticket provider; ferry starting fares do not cover every traveler/vehicle; multi-leg rail tickets and arbitrary-origin road tolls are not guaranteed. Local source coverage is incomplete.
- No verified real-time POI hours, universal wheelchair accessibility, exact transfer durations, road routes/toll completeness or fully offline PWA/service-worker distribution.
- A failure of the travel API still allows the already-loaded client-side planning/PDF workflow **while needed third-party PDF libraries are reachable**; this is not a promise of use after network disconnection or without a cached page.
- Email PDF remains off; controller legal name/contact, third-party data agreements and retention proof need owner/legal review prior to commercial activation. No paid MVP, refund processing or transaction functionality.

## Rollback and change management

See [rollback runbook](ROLLBACK_RUNBOOK_2026-11-27.md): last good pre-Stage 6 main `348565e99caa6adfb30fda1c5089523cf0cdb7c2`, which is a public/worker safety baseline. Rollback the website by **reviewed revert commit on main**, not a force push; Worker versions are independently managed in Cloudflare. Do not equate prior Pages publication with reverting an independently faulty Worker.

**Status:** Release candidate; final production SHA, pages run, public QA and issue #15 record populated after successful merge/public verification.
