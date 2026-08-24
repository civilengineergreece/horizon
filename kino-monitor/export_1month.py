import csv
import sqlite3
import time
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

START = date(2026, 7, 24)
END = date(2026, 8, 23)
TZ = ZoneInfo("Europe/Athens")
GAME_ID = 1100
API_ROOT = f"https://api.opap.gr/draws/v3.0/{GAME_ID}"
OUT = Path("kino-monitor/export_1month_output")
OUT.mkdir(parents=True, exist_ok=True)
CSV = OUT / "KINO_MZI_1month_2026-07-24_to_2026-08-23.csv"
DB = OUT / "KINO_MZI_1month_2026-07-24_to_2026-08-23.sqlite3"
SUMMARY = OUT / "KINO_MZI_1month_summary.txt"
HEADERS = {"Accept": "application/json", "User-Agent": "KINO-one-month-export/2.0"}


def request_json(url, params=None, retries=6):
    last = None
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=40)
            if r.status_code == 429 or r.status_code == 403:
                last = RuntimeError(f"HTTP {r.status_code}")
                time.sleep(4 + attempt * 4)
                continue
            if 400 <= r.status_code < 500:
                raise ValueError(f"HTTP {r.status_code}: {r.url}")
            r.raise_for_status()
            return r.json()
        except ValueError:
            raise
        except Exception as exc:
            last = exc
            time.sleep(min(20, 2 ** attempt))
    raise RuntimeError(f"request failed {url} {params}: {last}")


def extract_draw_ids(obj):
    ids = []
    if isinstance(obj, int):
        if obj > 100000:
            ids.append(obj)
    elif isinstance(obj, list):
        for value in obj:
            ids.extend(extract_draw_ids(value))
    elif isinstance(obj, dict):
        for value in obj.values():
            ids.extend(extract_draw_ids(value))
    return ids


def ids_for_day(d):
    ds = d.isoformat()
    url = f"{API_ROOT}/draw-date/{ds}/{ds}/draw-id"
    data = request_json(url)
    ids = sorted(set(extract_draw_ids(data)))
    if len(ids) != 288:
        raise RuntimeError(f"{ds}: draw-id endpoint returned {len(ids)} ids, expected 288")
    print(ds, "draw ids", ids[0], "..", ids[-1], flush=True)
    return ids


def select_limit(url, from_id, to_id):
    for limit in (1000, 500, 200, 100):
        params = [
            ("page", 0),
            ("limit", limit),
            ("sort", "asc"),
            ("property", "drawId"),
            ("property", "drawTime"),
            ("property", "winningNumbers"),
        ]
        try:
            data = request_json(url, params=params, retries=3)
        except ValueError as exc:
            print("LIMIT rejected", limit, exc, flush=True)
            continue
        content = data.get("content", []) if isinstance(data, dict) else []
        if not content:
            continue
        total_elements = int(data.get("totalElements", 0))
        total_pages = int(data.get("totalPages", 1))
        print("LIMIT selected", limit, "content", len(content), "totalElements", total_elements, "totalPages", total_pages, flush=True)
        return limit, data
    raise RuntimeError("Could not find a working limit for draw-id range endpoint")


def parse_draw(obj):
    draw_id = int(obj["drawId"])
    ms = int(obj["drawTime"])
    dt = datetime.fromtimestamp(ms / 1000, TZ)
    nums = [int(x) for x in obj.get("winningNumbers", {}).get("list", [])]
    sidebets = obj.get("winningNumbers", {}).get("sidebets", {}) or {}
    odd = sidebets.get("oddNumbersCount")
    even = sidebets.get("evenNumbersCount")
    if odd is None or even is None:
        if len(nums) != 20:
            raise RuntimeError(f"Draw {draw_id} has no valid 20-number result")
        odd = sum(n % 2 for n in nums)
        even = 20 - odd
    odd, even = int(odd), int(even)
    if odd + even != 20:
        raise RuntimeError(f"Draw {draw_id}: invalid parity {odd}+{even}")
    result = "ΜΟΝΑ" if odd > even else ("ΖΥΓΑ" if even > odd else "ΙΣΟΠΑΛΙΑ")
    return (draw_id, dt.date().isoformat(), dt.strftime("%H:%M:%S"), odd, even, result, ms)


def main():
    start_ids = ids_for_day(START)
    time.sleep(1)
    end_ids = ids_for_day(END)
    from_id = min(start_ids)
    to_id = max(end_ids)
    expected = 31 * 288
    if to_id - from_id + 1 != expected:
        print("NOTE numeric id span", to_id - from_id + 1, "expected calendar draws", expected, flush=True)

    range_url = f"{API_ROOT}/draw-id/{from_id}/{to_id}"
    limit, first_page = select_limit(range_url, from_id, to_id)
    total_elements = int(first_page.get("totalElements", 0))
    total_pages = int(first_page.get("totalPages", 1))
    if total_elements != expected:
        raise RuntimeError(f"Range endpoint reports {total_elements} draws; expected exactly {expected}")

    all_objs = {}
    for obj in first_page.get("content", []):
        all_objs[int(obj["drawId"])] = obj

    for page in range(1, total_pages):
        params = [
            ("page", page),
            ("limit", limit),
            ("sort", "asc"),
            ("property", "drawId"),
            ("property", "drawTime"),
            ("property", "winningNumbers"),
        ]
        data = request_json(range_url, params=params)
        content = data.get("content", []) if isinstance(data, dict) else []
        for obj in content:
            all_objs[int(obj["drawId"])] = obj
        print("page", page + 1, "/", total_pages, "unique draws", len(all_objs), flush=True)
        time.sleep(0.4)

    if len(all_objs) != expected:
        raise RuntimeError(f"Fetched {len(all_objs)} unique draws; expected exactly {expected}")

    rows = [parse_draw(obj) for obj in all_objs.values()]
    rows = [r for r in rows if START.isoformat() <= r[1] <= END.isoformat()]
    rows.sort(key=lambda r: (r[6], r[0]))
    if len(rows) != expected:
        raise RuntimeError(f"After Athens-date filtering: {len(rows)} rows; expected {expected}")

    by_day = {}
    for row in rows:
        by_day[row[1]] = by_day.get(row[1], 0) + 1
    if len(by_day) != 31 or min(by_day.values()) != 288 or max(by_day.values()) != 288:
        raise RuntimeError(f"Day validation failed: {by_day}")

    if DB.exists():
        DB.unlink()
    con = sqlite3.connect(DB)
    con.executescript("""
        create table draws(
            draw_id integer primary key,
            draw_date text not null,
            draw_time text not null,
            odd_count integer not null,
            even_count integer not null,
            result text not null,
            draw_time_ms integer not null
        );
        create index idx_draw_time on draws(draw_time_ms);
    """)
    con.executemany("insert into draws values(?,?,?,?,?,?,?)", rows)
    con.commit()

    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["draw_id", "draw_date", "draw_time", "odd_count", "even_count", "result"])
        for r in rows:
            w.writerow(r[:6])

    rc = dict(con.execute("select result,count(*) from draws group by result"))
    first = con.execute("select draw_id,draw_date,draw_time from draws order by draw_time_ms limit 1").fetchone()
    last = con.execute("select draw_id,draw_date,draw_time from draws order by draw_time_ms desc limit 1").fetchone()
    summary = {
        "period": f"{START} to {END}",
        "calendar_days": 31,
        "draws_per_day": 288,
        "total_unique_draws": len(rows),
        "first_draw": first,
        "last_draw": last,
        "MONA": rc.get("ΜΟΝΑ", 0),
        "ZYGA": rc.get("ΖΥΓΑ", 0),
        "ISOPALIA": rc.get("ΙΣΟΠΑΛΙΑ", 0),
        "source": "Official OPAP API gameId 1100; draw-date draw-id + draw-id range endpoint",
        "range_endpoint_limit": limit,
    }
    SUMMARY.write_text("\n".join(f"{k}: {v}" for k, v in summary.items()), encoding="utf-8")
    con.close()
    print("EXPORT COMPLETE", summary, flush=True)


if __name__ == "__main__":
    main()
