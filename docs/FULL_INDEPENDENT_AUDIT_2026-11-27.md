# HORIZON — ανεξάρτητος επανέλεγχος MVP από μηδενική βάση (27/11/2026)

> **Συμπέρασμα:** Ο προηγούμενος έλεγχος Stage 6 ήταν πράσινος, αλλά **δεν κάλυπτε όλα τα σφάλματα**. Ο έλεγχος αυτός εντόπισε πραγματικό κενό προστασίας κόστους API, σιωπηλές ασυμφωνίες διάρκειας μεταξύ πτήσεων και PDF, ελλιπή έλεγχο παλαιών/αλλοιωμένων δεδομένων, και ελλιπή γνωστοποίηση κινδύνων χάρτη/QR. Οι διορθώσεις υποβάλλονται μέσω PR #54. Οι εμπορικές και νομικές εκκρεμότητες **δεν** θεωρούνται κλεισμένες.

## 1. Αφετηρία, εύρος και μέθοδος

- Σημείο αναφοράς: `main` `78dc75f3fb487fcc54cb3fac6fca223250e4a2ab`, δημοσιευμένη δωρεάν Stage 6.
- Απογραφή repository μέσω GitHub tree: **123 στοιχεία**, **73 αρχεία JS/MJS**. Ελέγχθηκαν στοχευμένα οι επιφάνειες παραγωγής (index, live-config, family/timing UI, itinerary PDF, MapLibre map, flights/hotels and manual audits), τα έξι στρώματα `worker/src/index*.js`, Cloudflare Wrangler/deploy configuration, οι δοκιμές και τα νομικά κείμενα. Η άσχετη υποεφαρμογή `kino-monitor/` **δεν αξιολογείται ως τμήμα του HORIZON travel website**.
- Έγινε στατικός έλεγχος ροών δεδομένων, URI, εισόδων, caching, credentials, λανθασμένων ορίων, CORS, οικογενειακής σύνθεσης, μη πραγματικής διαθεσιμότητας και πρωτοκόλλων δημοσίευσης. Ενισχύθηκε η **εκτελούμενη** δοκιμή με browser acceptance σε πραγματικό Chrome, mocked SerpApi/Cloudflare rate limiter, και πλήρη δημόσιο regression CI.
- Δεν έγινε penetration test εξωτερικού παρόχου, ασφαλής πραγματική πληρωμή, νομική γνωμοδότηση, πιστοποίηση WCAG, πλήρες end-to-end live geocoding για κάθε POI ή επαληθευμένο ticket/PNR. **Τα πράσινα tests δεν μπορούν να ισοδυναμούν με αυτά.**

## 2. Σφάλματα που βρέθηκαν / διορθώθηκαν στην υποψήφια έκδοση

| ID | Βαρύτητα | Πρόβλημα | Αντιμετώπιση και απόδειξη |
| --- | --- | --- | --- |
| A-01 | **Υψηλή / έκθεση πληρωμένου quota** | `/flights`, `/flight-returns`, `/flight-booking-options`, `/stays`, `/hotel-details` προσπελαύνονταν δημόσια, χωρίς Cloudflare per-IP quota gate. CORS δεν εμποδίζει scripted calls. | `worker/src/index-v6.js`: πριν από κάθε paid endpoint, έλεγχος ακριβούς Origin, επαληθευμένης `CF-Connecting-IP` και **υποχρεωτικό native `TRAVEL_SEARCH_RATE_LIMIT`**, 12 αιτήματα/60s/IP από `worker/wrangler.jsonc`. Αν λείπει binding → 503, υπέρβαση → 429, χωρίς call σε SerpApi. `worker/tests/search-guard.test.mjs`: υποχρεωτική απαγόρευση και θετικό mock contract σε όλες τις επιφάνειες. |
| A-02 | **Υψηλή / λανθασμένο πλάνο** | Flight date sync επέτρεπε μέχρι **365 ημέρες** ενώ το itinerary/PDF κλείδωνε στα 14. Δινόταν επίσης μήνυμα «ενημερώθηκαν» παρότι η ενημέρωση μπορούσε να αποτύχει. | `flights-panel.js`: 1–14 ημέρες και truthful error status. `tests/flight-ui-browser.mjs`: αλλαγή από 6 σε 20 ημέρες δεν αντικαθιστά το πλάνο. |
| A-03 | **Μεσαία / wizard crash** | Αλλοιωμένο `localStorage` `null`, array, αρνητικό ή δεκαδικό `_step` μπορούσε να προκαλέσει αποτυχία αρχικής φόρτωσης/λανθασμένο βήμα. Αποτυχία `localStorage.setItem` μπορούσε να διακόψει την πλοήγηση. | `index.html`: normalize root object, clamp integer wizard step 0–9, ασφαλής `save()`. `tests/audit-wizard-browser.mjs`: malformed storage variants και QuotaExceededError. |
| A-04 | **Μεσαία / λανθασμένες οικογενειακές τιμές** | Wizard δέχονταν αρνητικούς/κλασματικούς/υπερβολικούς ταξιδιώτες με σιωπηλή στρογγυλοποίηση, και διάρκεια πάνω από 14. Επίσης αποθηκευμένη κατάσταση μπορούσε να πηδήξει το τελευταίο βήμα παρακάμπτοντας παλαιότερα υποχρεωτικά πεδία. | `traveler-categories.js`, `calendar-duration.js`, `index.html`: ακέραιοι επιβάτες, budget εντός ορίων, αληθινή ISO date, 1–14 ημέρες σε όλες τις εισόδους, **επανέλεγχος όλων των απαιτούμενων βημάτων** πριν τα αποτελέσματα. `tests/audit-wizard-browser.mjs` desktop/mobile. |
| A-05 | **Μεσαία / παραπλανητική γεωγραφική βεβαιότητα** | Δημόσιο MapLibre/Nominatim/OSRM επιστρέφει αποτελέσματα αναζήτησης σημείων και **οδική** εκτίμηση, όχι επαληθευμένη πεζή διαδρομή ή ασφαλές ΜΜΜ. Η ένδειξη «πραγματική διαδρομή» ήταν υπερβολικά απόλυτη. | `map.html`: «ενδεικτική οδική διαδρομή», μη επαληθευμένες θέσεις, ρητό error όταν δεν υπάρχουν σημεία. Δεν παρουσιάζεται πλέον ως ακριβής γεωκωδικοποίηση. |
| A-06 | **Μεσαία / link safety** | Το πεδίο `wiki.url` από τρίτη πηγή χρησιμοποιούνταν ως `href` χωρίς τελικό allowlist πρωτοκόλλου/domain. | `map.html`: μόνο HTTPS και πραγματικό `wikipedia.org` ή subdomain `.wikipedia.org`, με `noopener noreferrer`. |
| A-07 | **Μεσαία / ιδιωτικότητα QR** | Ονόματα στάσεων/δραστηριοτήτων μεταφέρονται ως plain URL query σε map links και PDF QR. Πιθανές προσωπικές σημειώσεις μπορεί να κοινοποιηθούν κατά λάθος και να σταλούν στο Nominatim/Wikipedia. | Ρητή προειδοποίηση στον itinerary/PDF editor και στο `privacy.html`. **Δεν** έχει υλοποιηθεί ιδιωτικό geocoding ή E2E προστασία του link. |

## 3. Ανεξάρτητα επιχειρησιακά checks

| Περιοχή | Τι ελέγχουμε | Τι **δεν** αποδεικνύεται |
| --- | --- | --- |
| Πτήσεις | Επιλογή αναχώρησης/επιστροφής, ανανέωση τιμής, signed Google seller POST/GET, επιβάτες και κανόνες ηλικίας, μη διπλή αποσκευή, χειροκίνητος έλεγχος checkout, ασφάλεια stale προσφοράς | Πραγματική έκδοση εισιτηρίου, οριστικό ποσό πωλητή, PNR ή επιτυχής πληρωμή |
| Ξενοδοχεία | Πραγματικό format Google Hotels fixtures, παιδιά/βρέφη/ηλικίες, πολιτική κούνιας, συνολικό ποσό/φόροι, stale quote, επιλεγμένα δωμάτια και εξωτερικός πωλητής | Inventory hold, εγγυημένη κούνια/ακύρωση ή τιμή στο τελευταίο checkout |
| Επίγεια/πλοία | Προέλευση τιμών τρένων/πλοίων, no-live-KTEL, κόστη ΙΧ μόνο σε υποστηριζόμενες αφετηρίες, ημερομηνίες και όχι phantom fare | Πλήρης ελληνική κάλυψη ή εγγυημένη οικογενειακή τιμή/όχημα |
| Itinerary/PDF | Πέντε Ελλάδα-first περιπτώσεις × desktop 1280 / mobile 390, trip scope, ημέρες, budget, 4-page fillable PDF, QR/map links | Γεωκωδικοποιημένες συντεταγμένες όλων των στάσεων, αληθινές ώρες λειτουργίας/μετακινήσεων |
| Ασφάλεια/API | Ισχυρός fail-closed έλεγχος email με Turnstile & quota, νέος guard για Search API, no-billable production health | Global 100% quota guarantee, penetration test/attestation τρίτων, account WAF / provider-billing cap |
| Ιδιωτικότητα | LocalStorage, consent email unchecked, δημόσιο privacy/terms, ξεχωριστή ροή PDF | GDPR/DPA/legal certification, επαληθευμένα στοιχεία controller ή retention τρίτων |
| Δημοσίευση | Unit, Chrome candidate, Chrome public site, CI commit gate, documented revert/Worker rollback | Απόλυτη απουσία bug ή εγγυημένο zero-downtime rollback |

## 4. Ανοιχτοί κίνδυνοι / παραλείψεις που **δεν** λύνει το PR

1. **R-01 — Provider quota, μέτριος–υψηλός υπολειπόμενος κίνδυνος:** Cloudflare native limit είναι approximate/per-PoP, Origin header μπορεί να πλαστογραφηθεί από scripted client, και ένας supplier lookup μπορεί να κάνει πάνω από ένα API call (π.χ. αεροδρόμια). Απαιτούνται account-wide spend caps/alerts σε SerpApi, WAF/managed challenges, global durable limit και analytics πριν από ευρεία χρήση. Κλειδιά/μυστικά να μην μπουν σε repo ή browser.
2. **R-02 — Κρίσιμο για εμπορική διάθεση:** Δεν υπάρχουν εξουσιοδοτημένα seller booking/payment/PNR APIs, πραγματικό checkout last-screen price ή ανεξάρτητες συμφωνίες διαθεσιμότητας. Τα user-entered checkout στοιχεία είναι πάντα δηλωμένα, όχι επαληθευμένα. Stage 4 εξωτερικό dependency.
3. **R-03 — GDPR/νομικά:** Λείπουν επαληθευμένο όνομα/στοιχεία υπεύθυνου επεξεργασίας, processor DPAs, πραγματικοί retention χρόνοι, τελική νομική τεκμηρίωση. Email provider παραμένει απενεργοποιημένος. Stage 5 partial.
4. **R-04 — Maps:** Real-world location correctness, accessibility, transit/πεζή διαδρομή, δημόσιο Nominatim/OSRM capacity/rate policy, link privacy και εξαρτήσεις map tiles δεν πιστοποιούνται από static/browser smoke. Χρειάζεται dedicated provider & place QA, ενδεχομένως branded geocoding/navigation API.
5. **R-05 — UI access & supply chain:** Δεν έχει γίνει ανεξάρτητη WCAG 2.2 keyboard/screen-reader/contrast certification, CSP/SRI audit για third-party dynamic CDN scripts, dependency lock/pinning και reproducible build review. Τα runtime scripts προέρχονται και από τρίτους.
6. **R-06 — Offline/long trips:** Δεν υπάρχει εγγυημένη λειτουργία χωρίς internet ή προφορτωμένες βιβλιοθήκες PDF/map tiles. **Ταξίδια πάνω από 14 ημέρες δεν υποστηρίζονται** σε όλο το edit/PDF MVP. Επέκταση >14 απαιτεί συνολικό σχεδιασμό, όχι σιωπηλό truncation.
7. **R-07 — Επικύρωση πραγματικών ταξιδιωτικών δεδομένων:** Το top-five Greece-first budget είναι μαθηματική εκτίμηση από fixtures. Δεν συγκρίνεται με φρέσκια τιμή δωματίου, αυτοκινήτου, πλοίου ή airline που επιτρέπεται να κρατηθεί στις ίδιες συνθήκες.

## 5. Τελική κρίση και ασφαλής συνέχεια

- **Για δωρεάν, μη συναλλακτικό MVP:** Μπορεί να παραμείνει διαθέσιμο εφόσον όλα τα PR+main+published Chrome gates περάσουν και ο νέος Cloudflare Worker έχει πραγματικά το `TRAVEL_SEARCH_RATE_LIMIT` binding. **Fail-closed 503** σε αναζητήσεις είναι προτιμότερο από ανεξέλεγκτη χρέωση αν το binding λείπει.
- **Για εμπορικό booking product ή ενεργό email:** **Όχι ακόμη**. Απαραίτητα external partners, πραγματικό booking, owner/controller credentials, privacy review και αντι-abuse monitoring.
- **Μη δεσμευτική τεκμηρίωση:** Το πράσινο CI είναι regression evidence των συγκεκριμένων acceptance cases, όχι απόλυτη εγγύηση. Επιβεβαίωση ακριβούς production commit και Worker deployment θα καταγραφεί στο issue #15 μετά το merge.

**Reference:** [MVP release notes](MVP_RELEASE_NOTES_2026-11-27.md) · [Stage 5 email security](STAGE5_SECURITY_PRIVACY_2026-11-27.md) · [Rollback](ROLLBACK_RUNBOOK_2026-11-27.md).
