import csv
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

START = date(2021, 8, 24)
END = date(2026, 8, 24)
TZ = ZoneInfo("Europe/Athens")
BASE = "https://api.opap.gr/draws/v3.0/1100/draw-date/{d}/{d}"
OUT = Path("kino-monitor/export_5years_output")
OUT.mkdir(parents=True, exist_ok=True)
DB = OUT / "KINO_5years_2021-08-24_to_2026-08-24.sqlite3"
CSV = OUT / "KINO_5years_2021-08-24_to_2026-08-24.csv"
SUMMARY = OUT / "KINO_5years_summary.txt"
HEADERS = {"Accept": "application/json", "User-Agent": "KINO-history-export/2.0"}


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
    test_day = END - timedelta(days=1)
    url = BASE.format(d=test_day.isoformat())
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
        print(
            "PROBE",
            name,
            "content=",
            len(content),
            "totalPages=",
            data.get("totalPages") if isinstance(data, dict) else None,
            "totalElements=",
            data.get("totalElements") if isinstance(data, dict) else None,
            "number=",
            data.get("number") if isinstance(data, dict) else None,
            "size=",
            data.get("size") if isinstance(data, dict) else None,
            flush=True,
        )
    best = max(results, key=lambda x: x[0])
    _, name, params, data = best
    extras = {k: v for k, v in params.items() if k != "page"}
    print("SELECTED PAGING", name, extras, "keys=", sorted(data.keys()) if isinstance(data, dict) else type(data), flush=True)
    return extras


PAGING_EXTRAS = {}


def fetch_day(d):
    url = BASE.format(d=d.isoformat())
    all_objs = {}
    previous_page_ids = None
    page = 0
    while page < 100:
        params = {"page": page, **PAGING_EXTRAS}
        data = request_json(url, params)
        content = data.get("content", []) if isinstance(data, dict) else []
        if not content:
            break
        page_ids = tuple(int(o.get("drawId", 0)) for o in content if o.get("drawId") is not None)
        if page > 0 and page_ids == previous_page_ids:
            raise RuntimeError(f"{d}: API ignored page parameter; repeated page {page}")
        previous_page_ids = page_ids
        before = len(all_objs)
        for obj in content:
            if obj.get("drawId") is not None:
                all_objs[int(obj["drawId"])] = obj
        if len(all_objs) == before and page > 0:
            break

        if isinstance(data, dict):
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
            raise RuntimeError(f"{d}: invalid parity counts for draw {obj.get('drawId')}: {odd}+{even}")
        ms = int(obj["drawTime"])
        dt = datetime.fromtimestamp(ms / 1000, TZ)
        result = "ΜΟΝΑ" if odd > even else ("ΖΥΓΑ" if even > odd else "ΙΣΟΠΑΛΙΑ")
        rows.append(
            (
                int(obj["drawId"]),
                ms,
                dt.isoformat(timespec="seconds"),
                dt.date().isoformat(),
                dt.strftime("%H:%M:%S"),
                odd,
                even,
                result,
            )
        )
    rows.sort(key=lambda r: (r[1], r[0]))

    # Full historical KINO days must contain far more than a single 10-result API page.
    if d < END and len(rows) < 100:
        raise RuntimeError(f"{d}: only {len(rows)} draws fetched; pagination is incomplete")
    return d, rows


def main():
    global PAGING_EXTRAS
    PAGING_EXTRAS = probe_paging()

    if DB.exists():
        DB.unlink()
    con = sqlite3.connect(DB)
    con.executescript(
        """
        create table draws(
            draw_id integer primary key,
            draw_time_ms integer not null,
            draw_time_local text not null,
            draw_date text not null,
            draw_clock text not null,
            odd_count integer not null,
            even_count integer not null,
            result text not null,
            no_odd_streak integer,
            no_even_streak integer,
            tie_streak integer
        );
        create index idx_time on draws(draw_time_ms);
        create table metadata(key text primary key, value text not null);
        """
    )

    ds = list(days())
    failures = []
    total = 0
    day_counts = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = {ex.submit(fetch_day, d): d for d in ds}
        for k, future in enumerate(as_completed(futures), 1):
            d = futures[future]
            try:
                _, rows = future.result()
            except Exception as exc:
                failures.append(str(exc))
                print("FAILED", d, exc, flush=True)
                continue
            day_counts[d.isoformat()] = len(rows)
            con.executemany(
                "insert or replace into draws(draw_id,draw_time_ms,draw_time_local,draw_date,draw_clock,odd_count,even_count,result) values(?,?,?,?,?,?,?,?)",
                rows,
            )
            con.commit()
            total += len(rows)
            if k % 20 == 0:
                print(f"{k}/{len(ds)} days, {total} rows", flush=True)

    if failures:
        raise RuntimeError("API failures: " + repr(failures[:30]))

    no_odd = no_even = ties = 0
    batch = []
    for draw_id, result in con.execute("select draw_id,result from draws order by draw_time_ms,draw_id"):
        no_odd = 0 if result == "ΜΟΝΑ" else no_odd + 1
        no_even = 0 if result == "ΖΥΓΑ" else no_even + 1
        ties = ties + 1 if result == "ΙΣΟΠΑΛΙΑ" else 0
        batch.append((no_odd, no_even, ties, draw_id))
        if len(batch) >= 20000:
            con.executemany(
                "update draws set no_odd_streak=?,no_even_streak=?,tie_streak=? where draw_id=?",
                batch,
            )
            batch = []
    if batch:
        con.executemany(
            "update draws set no_odd_streak=?,no_even_streak=?,tie_streak=? where draw_id=?",
            batch,
        )
    con.commit()

    hdr = [
        "draw_id",
        "draw_time_local",
        "draw_date",
        "draw_clock",
        "odd_count",
        "even_count",
        "result",
        "no_odd_streak",
        "no_even_streak",
        "tie_streak",
    ]
    q = "select " + ",".join(hdr) + " from draws order by draw_time_ms,draw_id"
    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(hdr)
        writer.writerows(con.execute(q))

    count = con.execute("select count(*) from draws").fetchone()[0]
    first = con.execute("select draw_id,draw_time_local from draws order by draw_time_ms limit 1").fetchone()
    last = con.execute("select draw_id,draw_time_local from draws order by draw_time_ms desc limit 1").fetchone()
    rc = dict(con.execute("select result,count(*) from draws group by result"))
    min_day = min(day_counts.values()) if day_counts else 0
    max_day = max(day_counts.values()) if day_counts else 0

    if count < 300000:
        raise RuntimeError(f"Only {count} total draws; expected a full 5-year KINO dataset (>300,000)")

    summary = {
        "period": f"{START} to {END}",
        "generated_at_athens": datetime.now(TZ).isoformat(timespec="seconds"),
        "calendar_days": len(ds),
        "total_unique_draws": count,
        "min_draws_in_a_day": min_day,
        "max_draws_in_a_day": max_day,
        "first_draw": first,
        "last_draw": last,
        "MONA": rc.get("ΜΟΝΑ", 0),
        "ZYGA": rc.get("ΖΥΓΑ", 0),
        "ISOPALIA": rc.get("ΙΣΟΠΑΛΙΑ", 0),
        "source": "Official OPAP API gameId 1100, all paginated results by date",
        "columns": ",".join(hdr),
    }
    for key, value in summary.items():
        con.execute("insert or replace into metadata values(?,?)", (key, str(value)))
    con.commit()
    con.close()

    SUMMARY.write_text("\n".join(f"{k}: {v}" for k, v in summary.items()), encoding="utf-8")
    print("EXPORT COMPLETE", flush=True)
    for p in (DB, CSV, SUMMARY):
        print(p, p.stat().st_size, flush=True)


if __name__ == "__main__":
    main()
