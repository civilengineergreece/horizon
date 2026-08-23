from __future__ import annotations

import csv
import json
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

GAME_ID = 1100
START_DATE = date(2021, 8, 24)
END_DATE = date(2026, 8, 24)
API_DAY = f"https://api.opap.gr/draws/v3.0/{GAME_ID}/draw-date/{{day}}/{{day}}"
ATHENS = ZoneInfo("Europe/Athens")
OUT_DIR = Path("export_5y")
DB_PATH = OUT_DIR / "kino_odds_evens_2021-08-24_to_2026-08-24.sqlite3"
CSV_PATH = OUT_DIR / "kino_odds_evens_2021-08-24_to_2026-08-24.csv"
SUMMARY_PATH = OUT_DIR / "summary.json"
MAX_WORKERS = 6


def all_days(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def classify(numbers: list[int]) -> tuple[int, int, str]:
    if len(numbers) != 20:
        raise ValueError(f"expected 20 numbers, got {len(numbers)}")
    odd = sum(1 for n in numbers if int(n) % 2)
    even = 20 - odd
    if odd > even:
        result = "ΜΟΝΑ"
    elif even > odd:
        result = "ΖΥΓΑ"
    else:
        result = "ΙΣΟΠΑΛΙΑ"
    return odd, even, result


def request_json(session: requests.Session, url: str, params: dict, attempts: int = 6):
    last = None
    for attempt in range(attempts):
        try:
            r = session.get(url, params=params, timeout=30)
            if r.status_code == 429:
                wait = min(30, 2 ** attempt)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last = e
            if attempt == attempts - 1:
                break
            time.sleep(min(20, 1.5 ** attempt))
    raise RuntimeError(f"request failed: {url} params={params}: {last}")


def fetch_day(day: date):
    day_s = day.isoformat()
    url = API_DAY.format(day=day_s)
    session = requests.Session()
    session.headers.update({
        "User-Agent": "KinoFiveYearExporter/1.0",
        "Accept": "application/json",
    })

    page = 0
    rows = []
    seen = set()
    while True:
        data = request_json(session, url, {"size": 300, "page": page})
        if isinstance(data, dict):
            content = data.get("content") or []
            total_pages = data.get("totalPages")
        elif isinstance(data, list):
            content = data
            total_pages = 1
        else:
            raise RuntimeError(f"unexpected payload type for {day_s}: {type(data)}")

        for obj in content:
            nums = (obj.get("winningNumbers") or {}).get("list") or []
            if not nums:
                continue
            draw_id = int(obj["drawId"])
            if draw_id in seen:
                continue
            seen.add(draw_id)
            odd, even, result = classify([int(n) for n in nums])
            ms = int(obj["drawTime"])
            dt_gr = datetime.fromtimestamp(ms / 1000, tz=timezone.utc).astimezone(ATHENS)
            rows.append((
                draw_id,
                ms,
                dt_gr.isoformat(timespec="seconds"),
                dt_gr.date().isoformat(),
                dt_gr.strftime("%H:%M:%S"),
                odd,
                even,
                result,
            ))

        if total_pages is None:
            if len(content) < 300:
                break
            page += 1
        else:
            page += 1
            if page >= int(total_pages):
                break

    return day_s, rows


def init_db(conn: sqlite3.Connection):
    conn.executescript(
        """
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA temp_store=MEMORY;

        DROP TABLE IF EXISTS kino_odds_evens;
        DROP TABLE IF EXISTS metadata;

        CREATE TABLE kino_odds_evens (
            draw_id INTEGER PRIMARY KEY,
            draw_time_ms INTEGER NOT NULL,
            draw_datetime_greece TEXT NOT NULL,
            draw_date_greece TEXT NOT NULL,
            draw_time_greece TEXT NOT NULL,
            odd_count INTEGER NOT NULL,
            even_count INTEGER NOT NULL,
            result TEXT NOT NULL CHECK (result IN ('ΜΟΝΑ','ΖΥΓΑ','ΙΣΟΠΑΛΙΑ'))
        );

        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """
    )


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    dates = list(all_days(START_DATE, END_DATE))
    failed = []
    completed_days = 0
    inserted = 0
    started = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_day, d): d for d in dates}
        for fut in as_completed(futures):
            d = futures[fut]
            try:
                day_s, rows = fut.result()
                if rows:
                    conn.executemany(
                        """
                        INSERT OR REPLACE INTO kino_odds_evens
                        (draw_id, draw_time_ms, draw_datetime_greece, draw_date_greece,
                         draw_time_greece, odd_count, even_count, result)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        rows,
                    )
                    conn.commit()
                    inserted += len(rows)
                completed_days += 1
                if completed_days % 50 == 0 or completed_days == len(dates):
                    elapsed = time.time() - started
                    print(f"days {completed_days}/{len(dates)}; fetched rows {inserted}; elapsed {elapsed:.1f}s", flush=True)
            except Exception as e:
                failed.append((d.isoformat(), str(e)))
                print(f"FAILED {d}: {e}", flush=True)

    if failed:
        conn.close()
        raise SystemExit("Failed days: " + json.dumps(failed, ensure_ascii=False, indent=2))

    # Keep only records whose Greek local date is inside the exact requested range.
    conn.execute(
        "DELETE FROM kino_odds_evens WHERE draw_date_greece < ? OR draw_date_greece > ?",
        (START_DATE.isoformat(), END_DATE.isoformat()),
    )
    conn.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_kino_date ON kino_odds_evens(draw_date_greece);
        CREATE INDEX IF NOT EXISTS idx_kino_result ON kino_odds_evens(result);
        CREATE INDEX IF NOT EXISTS idx_kino_datetime ON kino_odds_evens(draw_datetime_greece);

        DROP VIEW IF EXISTS summary_by_result;
        CREATE VIEW summary_by_result AS
        SELECT result, COUNT(*) AS draws,
               ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM kino_odds_evens), 4) AS percent
        FROM kino_odds_evens
        GROUP BY result
        ORDER BY draws DESC;
        """
    )

    generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    row_count = conn.execute("SELECT COUNT(*) FROM kino_odds_evens").fetchone()[0]
    first_row = conn.execute("SELECT draw_datetime_greece FROM kino_odds_evens ORDER BY draw_time_ms LIMIT 1").fetchone()
    last_row = conn.execute("SELECT draw_datetime_greece FROM kino_odds_evens ORDER BY draw_time_ms DESC LIMIT 1").fetchone()
    counts = dict(conn.execute("SELECT result, COUNT(*) FROM kino_odds_evens GROUP BY result").fetchall())

    metadata = {
        "game": "OPAP KINO",
        "game_id": str(GAME_ID),
        "requested_start_date_greece": START_DATE.isoformat(),
        "requested_end_date_greece": END_DATE.isoformat(),
        "first_draw_datetime_greece": first_row[0] if first_row else "",
        "last_draw_datetime_greece": last_row[0] if last_row else "",
        "row_count": str(row_count),
        "count_ΜΟΝΑ": str(counts.get("ΜΟΝΑ", 0)),
        "count_ΖΥΓΑ": str(counts.get("ΖΥΓΑ", 0)),
        "count_ΙΣΟΠΑΛΙΑ": str(counts.get("ΙΣΟΠΑΛΙΑ", 0)),
        "generated_at_utc": generated_at,
        "source_endpoint": API_DAY.replace("{day}", "YYYY-MM-DD"),
        "classification": "ΜΟΝΑ if odd_count>even_count; ΖΥΓΑ if even_count>odd_count; ΙΣΟΠΑΛΙΑ if 10-10",
        "note": "Only odds/evens classification data are stored; the 20 winning numbers are not stored.",
    }
    conn.executemany("INSERT INTO metadata(key, value) VALUES (?, ?)", metadata.items())
    conn.commit()

    with CSV_PATH.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow([
            "draw_id",
            "draw_datetime_greece",
            "draw_date_greece",
            "draw_time_greece",
            "odd_count",
            "even_count",
            "result",
        ])
        cur = conn.execute(
            """
            SELECT draw_id, draw_datetime_greece, draw_date_greece, draw_time_greece,
                   odd_count, even_count, result
            FROM kino_odds_evens
            ORDER BY draw_time_ms
            """
        )
        while True:
            batch = cur.fetchmany(10000)
            if not batch:
                break
            w.writerows(batch)

    summary = {
        "game": "OPAP KINO",
        "date_range_greece": [START_DATE.isoformat(), END_DATE.isoformat()],
        "rows": row_count,
        "counts": counts,
        "first_draw": first_row[0] if first_row else None,
        "last_draw": last_row[0] if last_row else None,
        "database": DB_PATH.name,
        "csv": CSV_PATH.name,
        "generated_at_utc": generated_at,
    }
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    # Integrity checks.
    bad = conn.execute(
        "SELECT COUNT(*) FROM kino_odds_evens WHERE odd_count + even_count != 20 OR result NOT IN ('ΜΟΝΑ','ΖΥΓΑ','ΙΣΟΠΑΛΙΑ')"
    ).fetchone()[0]
    dup = conn.execute(
        "SELECT COUNT(*) FROM (SELECT draw_id, COUNT(*) c FROM kino_odds_evens GROUP BY draw_id HAVING c > 1)"
    ).fetchone()[0]
    conn.close()

    if bad or dup or row_count == 0:
        raise SystemExit(f"Integrity check failed: bad={bad}, duplicate_draw_ids={dup}, rows={row_count}")

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
