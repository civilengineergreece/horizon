import csv
import sqlite3
from collections import Counter
from pathlib import Path

KINO_DAY_START = "2026-07-24"
KINO_DAY_END = "2026-08-23"
EXPECTED_DAYS = 31
EXPECTED_PER_KINO_DAY = 288
EXPECTED_TOTAL = EXPECTED_DAYS * EXPECTED_PER_KINO_DAY
EXPECTED_FIRST_ID = 1318882
EXPECTED_LAST_ID = 1327809
EXPECTED_FIRST_LOCAL = ("2026-07-24", "03:00:00")
EXPECTED_LAST_LOCAL = ("2026-08-24", "02:55:00")
PARTS = Path("kino-monitor/month_parts")
OUT = Path("kino-monitor/export_1month_output")
OUT.mkdir(parents=True, exist_ok=True)
CSV_OUT = OUT / "KINO_MZI_1month_2026-07-24_to_2026-08-23.csv"
DB_OUT = OUT / "KINO_MZI_1month_2026-07-24_to_2026-08-23.sqlite3"
SUMMARY = OUT / "KINO_MZI_1month_summary.txt"


def main():
    files = sorted(PARTS.rglob("*.csv"))
    if len(files) != EXPECTED_DAYS:
        raise RuntimeError(f"Expected {EXPECTED_DAYS} daily CSVs, found {len(files)}")

    rows = []
    for path in files:
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            daily = list(csv.DictReader(f))
        if len(daily) != EXPECTED_PER_KINO_DAY:
            raise RuntimeError(f"{path}: {len(daily)} rows, expected {EXPECTED_PER_KINO_DAY}")
        rows.extend(daily)

    ids = [int(r["draw_id"]) for r in rows]
    if len(rows) != EXPECTED_TOTAL or len(set(ids)) != EXPECTED_TOTAL:
        raise RuntimeError(f"Month validation failed: {len(rows)} rows / {len(set(ids))} unique IDs")
    if min(ids) != EXPECTED_FIRST_ID or max(ids) != EXPECTED_LAST_ID:
        raise RuntimeError(f"ID span invalid: {min(ids)}..{max(ids)}")
    if sorted(ids) != list(range(EXPECTED_FIRST_ID, EXPECTED_LAST_ID + 1)):
        raise RuntimeError("Draw IDs are not continuous across the month")

    per_kino_day = Counter(r["kino_day"] for r in rows)
    if len(per_kino_day) != EXPECTED_DAYS or set(per_kino_day.values()) != {EXPECTED_PER_KINO_DAY}:
        raise RuntimeError(f"KINO-day counts invalid: {dict(sorted(per_kino_day.items()))}")
    if min(per_kino_day) != KINO_DAY_START or max(per_kino_day) != KINO_DAY_END:
        raise RuntimeError(f"KINO-day span invalid: {min(per_kino_day)}..{max(per_kino_day)}")

    rows.sort(key=lambda r: (int(r["draw_time_ms"]), int(r["draw_id"])))
    if (rows[0]["draw_date"], rows[0]["draw_time"]) != EXPECTED_FIRST_LOCAL:
        raise RuntimeError(f"First timestamp invalid: {rows[0]['draw_date']} {rows[0]['draw_time']}")
    if (rows[-1]["draw_date"], rows[-1]["draw_time"]) != EXPECTED_LAST_LOCAL:
        raise RuntimeError(f"Last timestamp invalid: {rows[-1]['draw_date']} {rows[-1]['draw_time']}")

    calendar_counts = Counter(r["draw_date"] for r in rows)
    if calendar_counts["2026-07-24"] != 252 or calendar_counts["2026-08-24"] != 36:
        raise RuntimeError(f"Calendar-edge validation failed: {dict(sorted(calendar_counts.items()))}")

    headers = ["kino_day", "draw_id", "draw_date", "draw_time", "odd_count", "even_count", "result"]
    with CSV_OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    if DB_OUT.exists():
        DB_OUT.unlink()
    con = sqlite3.connect(DB_OUT)
    con.executescript("""
        CREATE TABLE draws(
            draw_id INTEGER PRIMARY KEY,
            kino_day TEXT NOT NULL,
            draw_date TEXT NOT NULL,
            draw_time TEXT NOT NULL,
            odd_count INTEGER NOT NULL,
            even_count INTEGER NOT NULL,
            result TEXT NOT NULL,
            draw_time_ms INTEGER NOT NULL
        );
        CREATE INDEX idx_draw_time ON draws(draw_time_ms);
        CREATE INDEX idx_kino_day ON draws(kino_day);
        CREATE INDEX idx_result ON draws(result);
    """)
    con.executemany(
        "INSERT INTO draws VALUES(?,?,?,?,?,?,?,?)",
        [
            (
                int(r["draw_id"]), r["kino_day"], r["draw_date"], r["draw_time"],
                int(r["odd_count"]), int(r["even_count"]), r["result"], int(r["draw_time_ms"])
            )
            for r in rows
        ],
    )
    con.commit()
    result_counts = dict(con.execute("SELECT result, COUNT(*) FROM draws GROUP BY result"))
    first = con.execute("SELECT draw_id, draw_date, draw_time FROM draws ORDER BY draw_time_ms LIMIT 1").fetchone()
    last = con.execute("SELECT draw_id, draw_date, draw_time FROM draws ORDER BY draw_time_ms DESC LIMIT 1").fetchone()
    con.close()

    summary = {
        "kino_day_period": f"{KINO_DAY_START} to {KINO_DAY_END}",
        "actual_athens_period": "2026-07-24 03:00:00 to 2026-08-24 02:55:00",
        "kino_days": EXPECTED_DAYS,
        "draws_per_kino_day": EXPECTED_PER_KINO_DAY,
        "total_unique_draws": EXPECTED_TOTAL,
        "first_draw": first,
        "last_draw": last,
        "MONA": result_counts.get("ΜΟΝΑ", 0),
        "ZYGA": result_counts.get("ΖΥΓΑ", 0),
        "ISOPALIA": result_counts.get("ΙΣΟΠΑΛΙΑ", 0),
        "source": "Official OPAP API gameId 1100; all paginated KINO game-day results",
        "note": "OPAP KINO game-day runs 03:00 through 02:55 of the next calendar day",
    }
    SUMMARY.write_text("\n".join(f"{k}: {v}" for k, v in summary.items()), encoding="utf-8")
    print("MONTH EXPORT COMPLETE", summary, flush=True)


if __name__ == "__main__":
    main()
