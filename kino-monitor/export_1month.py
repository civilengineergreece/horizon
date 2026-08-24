import csv
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

START = date(2026, 7, 24)
END = date(2026, 8, 23)
TZ = ZoneInfo("Europe/Athens")
BASE = "https://api.opap.gr/draws/v3.0/1100/draw-date/{d}/{d}"
OUT = Path("kino-monitor/export_1month_output")
OUT.mkdir(parents=True, exist_ok=True)
CSV = OUT / "KINO_MZI_1month_2026-07-24_to_2026-08-23.csv"
DB = OUT / "KINO_MZI_1month_2026-07-24_to_2026-08-23.sqlite3"
SUMMARY = OUT / "KINO_MZI_1month_summary.txt"
HEADERS = {"Accept": "application/json", "User-Agent": "KINO-one-month-export/1.0"}


def days():
    d = START
    while d <= END:
        yield d
        d += timedelta(days=1)


def request_json(url, params=None):
    last = None
    for attempt in range(8):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=35)
            if r.status_code == 429:
                time.sleep(4 + attempt * 3)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            last = exc
            time.sleep(min(25, 2 ** attempt))
    raise RuntimeError(f"request failed {url} {params}: {last}")


def probe_paging():
    url = BASE.format(d=END.isoformat())
    variants = [
        ("size", {"page": 0, "size": 300}),
        ("pageSize", {"page": 0, "pageSize": 300}),
        ("limit", {"page": 0, "limit": 300}),
        ("page", {"page": 0}),
    ]
    results = []
    for name, params in variants:
        data = request_json(url, params)
        content = data.get("content", []) if isinstance(data, dict) else []
        results.append((len(content), name, params, data))
        print("PROBE", name, "content=", len(content), "totalPages=", data.get("totalPages"), "totalElements=", data.get("totalElements"), flush=True)
    best = max(results, key=lambda x: x[0])
    _, name, params, _ = best
    extras = {k: v for k, v in params.items() if k != "page"}
    print("SELECTED PAGING", name, extras, flush=True)
    return extras


PAGING_EXTRAS = {}


def fetch_day(d):
    url = BASE.format(d=d.isoformat())
    all_objs = {}
    previous_page_ids = None
    page = 0
    while page < 100:
        data = request_json(url, {"page": page, **PAGING_EXTRAS})
        content = data.get("content", []) if isinstance(data, dict) else []
        if not content:
            break
        page_ids = tuple(int(o.get("drawId", 0)) for o in content if o.get("drawId") is not None)
        if page > 0 and page_ids == previous_page_ids:
            raise RuntimeError(f"{d}: repeated page {page}")
        previous_page_ids = page_ids
        before = len(all_objs)
        for obj in content:
            if obj.get("drawId") is not None:
                all_objs[int(obj["drawId"])] = obj
        if len(all_objs) == before and page > 0:
            break
        if data.get("last") is True:
            break
        total_pages = data.get("totalPages")
        if isinstance(total_pages, int) and page + 1 >= total_pages:
            break
        page += 1

    rows = []
    for obj in all_objs.values():
        nums = [int(x) for x in obj.get("winningNumbers", {}).get("list", [])]
        sidebets = obj.get("winningNumbers", {}).get("sidebets", {}) or {}
        odd = sidebets.get("oddNumbersCount")
        even = sidebets.get("evenNumbersCount")
        if odd is None or even is None:
            if len(nums) != 20:
                continue
            odd = sum(n % 2 for n in nums)
            even = 20 - odd
        odd, even = int(odd), int(even)
        if odd + even != 20:
            raise RuntimeError(f"{d}: invalid counts draw {obj.get('drawId')}")
        ms = int(obj["drawTime"])
        dt = datetime.fromtimestamp(ms / 1000, TZ)
        result = "ΜΟΝΑ" if odd > even else ("ΖΥΓΑ" if even > odd else "ΙΣΟΠΑΛΙΑ")
        rows.append((int(obj["drawId"]), dt.date().isoformat(), dt.strftime("%H:%M:%S"), odd, even, result, ms))
    rows.sort(key=lambda r: (r[6], r[0]))
    if len(rows) < 100:
        raise RuntimeError(f"{d}: only {len(rows)} draws; incomplete pagination")
    return d, rows


def main():
    global PAGING_EXTRAS
    PAGING_EXTRAS = probe_paging()
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
    ds = list(days())
    total = 0
    failures = []
    day_counts = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fetch_day, d): d for d in ds}
        for future in as_completed(futures):
            d = futures[future]
            try:
                _, rows = future.result()
            except Exception as exc:
                failures.append(str(exc))
                continue
            day_counts[d.isoformat()] = len(rows)
            con.executemany("insert or replace into draws values(?,?,?,?,?,?,?)", rows)
            con.commit()
            total += len(rows)
            print(d, len(rows), "total", total, flush=True)
    if failures:
        raise RuntimeError("API failures: " + repr(failures))
    count = con.execute("select count(*) from draws").fetchone()[0]
    if count < 3000:
        raise RuntimeError(f"Only {count} draws; month export incomplete")
    rc = dict(con.execute("select result,count(*) from draws group by result"))
    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["draw_id","draw_date","draw_time","odd_count","even_count","result"])
        w.writerows(con.execute("select draw_id,draw_date,draw_time,odd_count,even_count,result from draws order by draw_time_ms,draw_id"))
    first = con.execute("select draw_id,draw_date,draw_time from draws order by draw_time_ms limit 1").fetchone()
    last = con.execute("select draw_id,draw_date,draw_time from draws order by draw_time_ms desc limit 1").fetchone()
    summary = {
        "period": f"{START} to {END}",
        "days": len(ds),
        "total_unique_draws": count,
        "min_draws_per_day": min(day_counts.values()),
        "max_draws_per_day": max(day_counts.values()),
        "first_draw": first,
        "last_draw": last,
        "MONA": rc.get("ΜΟΝΑ", 0),
        "ZYGA": rc.get("ΖΥΓΑ", 0),
        "ISOPALIA": rc.get("ΙΣΟΠΑΛΙΑ", 0),
        "source": "Official OPAP API gameId 1100, paginated by day",
    }
    SUMMARY.write_text("\n".join(f"{k}: {v}" for k,v in summary.items()), encoding="utf-8")
    con.close()
    print("EXPORT COMPLETE", summary, flush=True)

if __name__ == "__main__":
    main()
