# HORIZON Stage 4 — Seller checkout evidence boundaries (27 November 2026)

This is a **manual safety gate** for a Greece-first travel-planning MVP, not an integrated merchant payment/booking process.

## Quote-to-checkout provenance

| Source | User experience | How it affects budget | Not proven |
|---|---|---|---|
| Planner estimate | Estimated travel/room costs based on default models | Clearly labelled estimate | Any operator inventory, live availability, tax or payable amount |
| Google Flights source fare | Exact selected outbound + return (or one-way), with party and dates scoped | Provider quote + declared baggage/ground assumptions | Seller's payment screen, extra taxes/infant fees, ticket issuance |
| Selected airline seller quote | The supplier returned a named seller and a priced choice | Seller **quote** + declared extras (still not checkout) | Last-screen payment amount; included infant/baggage, guaranteed availability |
| Airline final-screen **manually reported** | User confirms same seller, both leg identifiers, party, child ages, infant seat/lap and fee, baggage/seats, taxes, payment fees, cancellation and availability; types EUR total | Replaces previously selected airline fare and baggage surcharge with user-entered all-in seller airline total, **then** adds separately declared airport ground transfer (no double count) | No independent verification; Horizon did not book, hold seats or charge the user |
| Google Hotels property/room quote | Source-reported dates, party, named seller/room, estimate or total tax basis | Quoted room cost when eligible | Hotel policy on crib, age, mandatory local climate fee, final payable amount |
| Hotel final-screen **manually reported** | Existing guarded audit checks rooms/bed capacity, child ages, infant and cot, climate fee, terms, source recency and HTTPS link | Replaces room quote with user-entered whole-party amount + explicitly excluded, separately confirmed fee/cot once | No independent verification, payment or confirmed booking |

## Safety and expiry

- All manual review data stays in browser localStorage. The page never asks for passport, identity, card, passenger names or passwords.
- Manual airline checkout requires a current **named seller quote** (not only Google flight search) and a date/party/route-matching saved flight record; source quote expires after **30 minutes**.
- Child and infant review cannot be skipped when children/infants are present. Mixed round-trip/self-transfer tickets require explicit additional confirmation.
- The checkout total must be the all-in **airline** charge for the full travel party. Prior manually estimated baggage is not added again. Airport/ground transfers remain **separate and not necessarily verified**.
- A re-search, new date/party/leg or changes to manually entered airline extras invalidates the previously reported airline checkout and returns to a quote-only budget.
- The results and transport comparison enforce the same evidence invariants and identify user-reported seller totals as **not independently verified**.
- Existing hotel climate/infant/cot review stays unchanged.

## Stage limit / external dependency

There is **no integration to a seller's real checkout API, payment transaction, confirmed accommodation reservation or airline ticket issuance**. Browser tests mock upstream supplier responses; real seller all-in prices and their checkout terms are **not independently tested**. Therefore Stage 4 is **partially implemented** until a seller with suitable partner credentials and permitted checkout API can be verified end to end. These caveats are product requirements, not post-launch UI decoration.
