# HORIZON Stage 3 — Greek surface transport evidence and pricing boundaries (27 Nov 2026)

**Goal:** No fictitious live service or family fare; preserve useful scheduling and estimated budget while clearly stating coverage limits.

| Mode | What the app currently can support | What it MUST NOT promise |
| --- | --- | --- |
| Ferry | Ferryhopper MCP trip search for candidate ports/dates, source-reported operators, departure/arrival and optional starting fare per choice; separate outward and return options | Complete adult/child/infant/vehicle/cabin quote, paid ticket, booked seat, summed cheapest legs as a valid family round trip |
| Train | Transitous/MOTIS timetable search for explicitly mapped station pairs. Realtime indicator only if the underlying feed marks it. Per-journey fare only if the feed has an unambiguous default/uncategorized rail-only fare | Family/infant total; confirmed booking availability; arbitrary reduced fare as standard; services on a different Greek-local date; any motorized bus leg hidden as a train |
| KTEL/bus | Broad comparison **estimates** based on app constants, with explicit lack of live KTEL/Omio access | Live schedule, operator booking, guaranteed price or existence of a route just because a destination permits “bus” |
| Private car | Illustrative fuel + toll assumptions where a road profile exists | Independently verified route distance/driver cost, parking, toll tariffs for exact trip, rental, ferry vehicle charges or wear-and-tear as included |
| Flight | Selected provider offer for the exact trip; seller quote tests separately | Confirmed ticket, infant fee, baggage allowances or final checkout without verifying seller |

## Scope and acceptance

1. Ferry price is **per-option source-reported starting fare**, never the travel party quote. Do not send an event that would overwrite the user's total transport budget. When return is absent, mark as incomplete. Preserve original comparison estimate.
2. Train fare information may be displayed as feed evidence, but must not overwrite the family comparison total without passenger- and booking-specific pricing. Reject routes on incorrect Greek-local date, nonrail motorized transfers presented as rail, and ambiguous discounted rider-only fares. Calendar checks reject impossible/inverted dates without supplier calls.
3. Bus/KTEL displays **not connected**. Do not imply Omio partner credentials, actual schedules or operator bookings.
4. HTML and external links supplied by transport sources are sanitized. Outbound/return, age group, vehicle, cabin and checkout limitations are explicit.
5. Tests use mocked supplier responses in Chrome desktop (1280px) and mobile (390px) and local Worker unit tests. Do **not** make paid live searches or create reservations as part of CI.

**External work remaining:** Production checks against actual ferry/rail feeds on representative dates, KTEL partner/operator schedule or fare integration, passenger-specific fare and vehicle/cabin checkout, actual road-route distance/tolls and operator terms. Until verified, only the guarded comparison MVP is in scope. This does not certify end-to-end bookings.
