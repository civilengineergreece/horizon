# HORIZON Stage 4 — Actual provider-to-seller booking handoff (27 Nov 2026)

## Provider-backed functionality implemented

Google Flights' **Booking Options API** returns a `booking_request` for selected flights. It may contain a simple HTTPS GET URL or an HTTPS POST to `https://www.google.com/travel/clk/f` together with an opaque `post_data` form payload. A POST is not a normal hyperlink; it requires submitting a native browser form with method POST. SerpApi explicitly documents that the request must retain its method and payload and must not be changed into a GET request.

The HORIZON Worker now extracts the **specific provider-returned booking handoff** for each seller and, for separate tickets, each independently offered leg. The UI displays an actionable seller handoff **only if present in the actual SerpApi response**, and executes it only after a user's deliberate click. There is no fabricated seller link.

### Rules

- No payment or booking within HORIZON. The browser navigates to the external Google Flights clickthrough or directly to the returned seller. The external site is responsible for current inventory, exact passenger/infant eligibility, ancillaries, terms, final amount, purchase and confirmation.
- Signed POST payload remains an opaque signed form value; the Worker never POSTs to Google or a seller itself. The UI builds an ephemeral `application/x-www-form-urlencoded` form only upon the user's click. The signed value is not persisted to localStorage.
- The Worker accepts POST redirect ONLY to Google-owned `google.com/travel/clk/f` over HTTPS; rejects unsafe, private-network, malformed and non-Google POST destinations. Direct GET links likewise require safe HTTPS URLs.
- Session-bound source price must still be fresh (<=30 minutes), with exactly matching origin/destination/dates/party. The redirect never sets `booked` status and never updates the trip budget by itself.
- Separate departure/return booking handoffs are distinct buttons and never represented as one fully purchased roundtrip.
- If the provider doesn't supply a real booking request, show a clear **no direct booking link** notice. No hardcoded booking portals or invented search link.
- Google Hotels property details already return a direct `link` to a room/seller offer. HORIZON now distinguishes an actual provider **rate-level** link from an inherited seller-only fallback; both remain external and neither proves the final room, taxes, cot, cancellation or availability.
- For both flights and hotels, the existing last-screen manual audit remains available as an optional user-reported budget entry, NOT a seller-API verified payment/transaction.

## Live verification scope

The code path is integrated with the **existing configured SerpApi-backed Cloudflare Worker**, not a mock backend or placeholder checkout page. Automated acceptance tests use provider fixtures and **do not create a real reservation** or submit a signed live POST. A full real-world redirect depends on the supplier actually returning a current booking request for the searched fare, third-party browser/cookie behavior, remaining inventory, and a user launching checkout.

**Important open dependency:** An API for verifying or executing a seller's final payment/booking step (with seat holds, PNR/ticket or hotel reservation, all taxes and infant/cot charges) is NOT supplied by Google Flights/Hotels SerpApi search APIs. Obtaining that capability still requires a genuine merchant/OTA partnership, booking API credentials and permitted production checkout workflow. Mark Stage 4 as **external seller handoff integrated / actual checkout verification not complete**.

**Docs:** [SerpApi booking options](https://serpapi.com/google-flights-booking-options), [SerpApi hotels property details](https://serpapi.com/google-hotels-property-details).
