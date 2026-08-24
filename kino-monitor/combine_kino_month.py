import csv
import sqlite3
from collections import Counter
from pathlib import Path

START = "2026-07-24"
END = "2026-08-23"
EXPECTED_DAYS = 31
EXPECTED_PER_DAY = 288
EXPECTED_TOTAL = EXPECTED_DAYS * EXPECTED_PER_DAY
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
            reader = csv.DictReader(f)
            daily = list(reader)
        if len(daily) != EXPECTED_PER_DAY:
            raise RuntimeError(f"{path}: {len(daily)} rows, expected {EXPECTED_PER_DAY}")
        rows.extend(daily)

    ids = [int(r["draw_id"]) for r in rows]
    if len(rows) != EXPECTED_TOTAL or len(set(ids)) != EXPECTED_TOTAL:
        raise RuntimeError(f"Month validation failed: {len(rows)} rows / {len(set(ids))} unique IDs")

    per_day = Counter(r["draw_date"] for r in rows)
    if len(per_day) != EXPECTED_DAYS or set(per_day.values()) != {EXPECTED_PER_DAY}:
        raise RuntimeError(f"Day counts invalid: {dict(sorted(per_day.items()))}")
    if min(per_day) != START or max(per_day) != END:
        raise RuntimeError(f"Date span invalid: {min(per_day)}..{max(per_day)}")

    rows.sort(key=lambda r: (int(r["draw_time_ms"]), int(r["draw_id"])))
    headers = ["draw_id", "draw_date", "draw_time", "odd_count", "even_count", "result"]
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
            draw_date TEXT NOT NULL,
            draw_time TEXT NOT NULL,
            odd_count INTEGER NOT NULL,
            even_count INTEGER NOT NULL,
            result TEXT NOT NULL,
            draw_time_ms INTEGER NOT NULL
        );
        CREATE INDEX idx_draw_time ON draws(draw_time_ms);
        CREATE INDEX idx_result ON draws(result);
    """)
    con.executemany(
        "INSERT INTO draws VALUES(?,?,?,?,?,?,?)",
        [
            (
                int(r["draw_id"]), r["draw_date"], r["draw_time"],
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
        "period": f"{START} to {END}",
        "calendar_days": EXPECTED_DAYS,
        "draws_per_day": EXPECTED_PER_DAY,
        "total_unique_draws": EXPECTED_TOTAL,
        "first_draw": first,
        "last_draw": last,
        "MONA": result_counts.get("ΜΟΝΑ", 0),
        "ZYGA": result_counts.get("ΖΥΓΑ", 0),
        "ISOPALIA": result_counts.get("ΙΣΟΠΑΛΙΑ", 0),
        "source": "Official OPAP API gameId 1100; all paginated daily results",
    }
    SUMMARY.write_text("\n".join(f"{k}: {v}" for k, v in summary.items()), encoding="utf-8")
    print("MONTH EXPORT COMPLETE", summary, flush=True)


if __name__ == "__main__":
    main()
