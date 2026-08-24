import csv
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

GAME_ID = 1100
TZ = ZoneInfo("Europe/Athens")
BASE = f"https://api.opap.gr/draws/v3.0/{GAME_ID}/draw-date/{{d}}/{{d}}"
HEADERS = {"Accept": "application/json", "User-Agent": "KINO-month-export/3.0"}
OUT = Path("kino-monitor/daily_parts")
OUT.mkdir(parents=True, exist_ok=True)


def get_json(url, params):
    last = None
    for attempt in range(7):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=35)
            if r.status_code in (403, 429):
                last = RuntimeError(f"HTTP {r.status_code}")
                time.sleep(8 + attempt * 7)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            last = exc
            time.sleep(min(20, 2 ** attempt))
    raise RuntimeError(f"request failed: {url} {params}: {last}")


def parse(obj):
    draw_id = int(obj["drawId"])
    ms = int(obj["drawTime"])
    dt = datetime.fromtimestamp(ms / 1000, TZ)
    nums = [int(x) for x in obj.get("winningNumbers", {}).get("list", [])]
    sidebets = obj.get("winningNumbers", {}).get("sidebets", {}) or {}
    odd = sidebets.get("oddNumbersCount")
    even = sidebets.get("evenNumbersCount")
    if odd is None or even is None:
        if len(nums) != 20:
            raise RuntimeError(f"draw {draw_id}: expected 20 winning numbers, got {len(nums)}")
        odd = sum(n % 2 for n in nums)
        even = 20 - odd
    odd = int(odd)
    even = int(even)
    if odd + even != 20:
        raise RuntimeError(f"draw {draw_id}: invalid parity counts {odd}+{even}")
    result = "ΜΟΝΑ" if odd > even else ("ΖΥΓΑ" if even > odd else "ΙΣΟΠΑΛΙΑ")
    return [draw_id, dt.date().isoformat(), dt.strftime("%H:%M:%S"), odd, even, result, ms]


def main(day):
    url = BASE.format(d=day)
    common = [("property", "drawId"), ("property", "drawTime"), ("property", "winningNumbers")]
    first = get_json(url, [("page", 0), *common])
    total_pages = int(first.get("totalPages", 0))
    total_elements = int(first.get("totalElements", 0))
    if total_elements != 288 or total_pages <= 0:
        raise RuntimeError(f"{day}: API reports {total_elements} draws / {total_pages} pages; expected 288 draws")

    objs = {}
    for o in first.get("content", []):
        objs[int(o["drawId"])] = o

    for page in range(1, total_pages):
        data = get_json(url, [("page", page), *common])
        for o in data.get("content", []):
            objs[int(o["drawId"])] = o
        time.sleep(0.12)

    if len(objs) != 288:
        raise RuntimeError(f"{day}: fetched {len(objs)} unique draws; expected 288")

    rows = [parse(o) for o in objs.values()]
    rows = [r for r in rows if r[1] == day]
    rows.sort(key=lambda r: (r[6], r[0]))
    if len(rows) != 288:
        raise RuntimeError(f"{day}: Athens-date validation left {len(rows)} rows; expected 288")

    path = OUT / f"{day}.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["draw_id", "draw_date", "draw_time", "odd_count", "even_count", "result", "draw_time_ms"])
        w.writerows(rows)

    print(f"OK {day}: 288 draws, {total_pages} API pages, {rows[0][0]}..{rows[-1][0]}", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: export_kino_day.py YYYY-MM-DD")
    main(sys.argv[1])
