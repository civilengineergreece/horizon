from __future__ import annotations

import csv
import json
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

GAME_ID = 1100
START_DATE = date(2026, 5, 24)
END_DATE = date(2026, 8, 23)  # last complete day
API_DAY = f"https://api.opap.gr/draws/v3.0/{GAME_ID}/draw-date/{{day}}/{{day}}"
ATHENS = ZoneInfo("Europe/Athens")
OUT = Path("export_3m")
MAX_WORKERS = 8


def classify(numbers):
    odd = sum(int(n) % 2 for n in numbers)
    even = 20 - odd
    if odd > even:
        result = "ΜΟΝΑ"
    elif even > odd:
        result = "ΖΥΓΑ"
    else:
        result = "ΙΣΟΠΑΛΙΑ"
    return odd, even, result


def get_json(session, url, params, attempts=6):
    last = None
    for i in range(attempts):
        try:
            r = session.get(url, params=params, timeout=30)
            if r.status_code == 429:
                time.sleep(min(20, 2 ** i))
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last = e
            time.sleep(min(10, 1.4 ** i))
    raise RuntimeError(last)


def fetch_day(day):
    s = requests.Session()
    s.headers.update({"User-Agent": "Kino3MonthStats/1.0", "Accept": "application/json"})
    url = API_DAY.format(day=day.isoformat())
    rows, seen, page = [], set(), 0
    while True:
        data = get_json(s, url, {"size": 300, "page": page})
        content = data.get("content", []) if isinstance(data, dict) else data
        total_pages = data.get("totalPages") if isinstance(data, dict) else 1
        for obj in content:
            nums = (obj.get("winningNumbers") or {}).get("list") or []
            if len(nums) != 20:
                continue
            draw_id = int(obj["drawId"])
            if draw_id in seen:
                continue
            seen.add(draw_id)
            odd, even, result = classify(nums)
            dt = datetime.fromtimestamp(int(obj["drawTime"]) / 1000, tz=timezone.utc).astimezone(ATHENS)
            rows.append({
                "draw_id": draw_id,
                "dt": dt,
                "odd": odd,
                "even": even,
                "result": result,
            })
        page += 1
        if total_pages is not None:
            if page >= int(total_pages):
                break
        elif len(content) < 300:
            break
    return day.isoformat(), rows


def days(a, b):
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


def run_lengths(results, target):
    lengths, cur = [], 0
    for r in results:
        if r == target:
            cur += 1
        elif cur:
            lengths.append(cur)
            cur = 0
    if cur:
        lengths.append(cur)
    return lengths


def gaps_without(results, target):
    lengths, cur = [], 0
    for r in results:
        if r != target:
            cur += 1
        elif cur:
            lengths.append(cur)
            cur = 0
    if cur:
        lengths.append(cur)
    return lengths


def main():
    OUT.mkdir(exist_ok=True)
    all_rows, failed = [], []
    ds = list(days(START_DATE, END_DATE))
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futs = {pool.submit(fetch_day, d): d for d in ds}
        for i, fut in enumerate(as_completed(futs), 1):
            d = futs[fut]
            try:
                _, rows = fut.result()
                all_rows.extend(rows)
            except Exception as e:
                failed.append((d.isoformat(), str(e)))
            if i % 20 == 0:
                print(f"days {i}/{len(ds)} rows {len(all_rows)}", flush=True)
    if failed:
        raise SystemExit(json.dumps({"failed": failed}, ensure_ascii=False, indent=2))

    all_rows = [r for r in all_rows if START_DATE <= r["dt"].date() <= END_DATE]
    all_rows.sort(key=lambda r: (r["dt"], r["draw_id"]))
    unique = {}
    for r in all_rows:
        unique[r["draw_id"]] = r
    all_rows = sorted(unique.values(), key=lambda r: (r["dt"], r["draw_id"]))

    results = [r["result"] for r in all_rows]
    counts = Counter(results)
    total = len(results)
    percentages = {k: round(100 * counts.get(k, 0) / total, 3) for k in ["ΜΟΝΑ", "ΖΥΓΑ", "ΙΣΟΠΑΛΙΑ"]}

    same_streaks = {}
    for k in ["ΜΟΝΑ", "ΖΥΓΑ", "ΙΣΟΠΑΛΙΑ"]:
        ls = run_lengths(results, k)
        same_streaks[k] = {
            "max": max(ls, default=0),
            "runs_ge_5": sum(x >= 5 for x in ls),
            "runs_ge_10": sum(x >= 10 for x in ls),
            "runs_ge_12": sum(x >= 12 for x in ls),
        }

    absence = {}
    for k in ["ΜΟΝΑ", "ΖΥΓΑ"]:
        gs = gaps_without(results, k)
        absence[k] = {
            "max_without": max(gs, default=0),
            "gaps_ge_12": sum(x >= 12 for x in gs),
        }

    distribution = Counter((r["odd"], r["even"]) for r in all_rows)
    by_split = [
        {"odd": o, "even": e, "count": c, "percent": round(100*c/total, 3)}
        for (o, e), c in sorted(distribution.items())
    ]

    summary = {
        "period": [START_DATE.isoformat(), END_DATE.isoformat()],
        "complete_days": len(ds),
        "total_draws": total,
        "first_draw": all_rows[0]["dt"].isoformat() if all_rows else None,
        "last_draw": all_rows[-1]["dt"].isoformat() if all_rows else None,
        "counts": {k: counts.get(k, 0) for k in ["ΜΟΝΑ", "ΖΥΓΑ", "ΙΣΟΠΑΛΙΑ"]},
        "percentages": percentages,
        "same_result_streaks": same_streaks,
        "absence_streaks": absence,
        "odd_even_split_distribution": by_split,
    }
    (OUT / "summary_3m.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    with (OUT / "draws_3m.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["draw_id", "datetime_greece", "odd_count", "even_count", "result"])
        for r in all_rows:
            w.writerow([r["draw_id"], r["dt"].isoformat(timespec="seconds"), r["odd"], r["even"], r["result"]])
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
