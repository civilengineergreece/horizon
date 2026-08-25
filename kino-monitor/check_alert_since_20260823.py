import time
from datetime import datetime
from zoneinfo import ZoneInfo
import requests

TZ = ZoneInfo('Europe/Athens')
START = datetime(2026, 8, 23, 21, 10, 0, tzinfo=TZ)
DAYS = ['2026-08-23', '2026-08-24', '2026-08-25']
BASE = 'https://api.opap.gr/draws/v3.0/1100/draw-date/{d}/{d}'
HEADERS = {'Accept':'application/json','User-Agent':'KINO-alert-independent-check/1.0'}


def get_json(url, params):
    last = None
    for attempt in range(8):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=40)
            if r.status_code in (403, 429):
                last = RuntimeError(f'HTTP {r.status_code}')
                time.sleep(5 + attempt * 4)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            last = exc
            time.sleep(min(20, 2 ** attempt))
    raise RuntimeError(f'Failed {url} {params}: {last}')


def fetch_day(day):
    url = BASE.format(d=day)
    first = get_json(url, {'page':0})
    pages = int(first.get('totalPages', 1))
    out = {}
    for o in first.get('content', []):
        if o.get('drawId') is not None:
            out[int(o['drawId'])] = o
    for page in range(1, pages):
        data = get_json(url, {'page':page})
        for o in data.get('content', []):
            if o.get('drawId') is not None:
                out[int(o['drawId'])] = o
        time.sleep(0.08)
    return list(out.values())


def parse(o):
    nums = [int(x) for x in (o.get('winningNumbers') or {}).get('list', [])]
    if len(nums) != 20:
        return None
    odd = sum(n % 2 for n in nums)
    even = 20 - odd
    result = 'ΜΟΝΑ' if odd > even else ('ΖΥΓΑ' if even > odd else 'ΙΣΟΠΑΛΙΑ')
    dt = datetime.fromtimestamp(int(o['drawTime']) / 1000, TZ)
    return {'id':int(o['drawId']), 'dt':dt, 'odd':odd, 'even':even, 'result':result}


def main():
    rows_by_id = {}
    for day in DAYS:
        objs = fetch_day(day)
        valid = 0
        for o in objs:
            r = parse(o)
            if r:
                rows_by_id[r['id']] = r
                valid += 1
        print(f'{day}: API objects={len(objs)}, completed_valid={valid}', flush=True)

    rows = sorted(rows_by_id.values(), key=lambda r:(r['dt'], r['id']))
    now = datetime.now(TZ)
    rows = [r for r in rows if r['dt'] <= now]
    if not rows:
        raise RuntimeError('No completed draws found')

    no_odd = 0
    no_even = 0
    max_no_odd_after = 0
    max_no_even_after = 0
    max_no_odd_row = None
    max_no_even_row = None
    crossings = []

    for r in rows:
        prev_no_odd = no_odd
        prev_no_even = no_even
        if r['result'] == 'ΜΟΝΑ':
            no_odd = 0
        else:
            no_odd += 1
        if r['result'] == 'ΖΥΓΑ':
            no_even = 0
        else:
            no_even += 1

        if r['dt'] >= START:
            if no_odd > max_no_odd_after:
                max_no_odd_after = no_odd; max_no_odd_row = r.copy()
            if no_even > max_no_even_after:
                max_no_even_after = no_even; max_no_even_row = r.copy()
            if prev_no_odd < 12 <= no_odd:
                crossings.append(('ΧΩΡΙΣ ΜΟΝΑ', r.copy(), no_odd))
            if prev_no_even < 12 <= no_even:
                crossings.append(('ΧΩΡΙΣ ΖΥΓΑ', r.copy(), no_even))

    after = [r for r in rows if r['dt'] >= START]
    latest = rows[-1]
    print('\n=== KINO ALERT CHECK ===')
    print('check_start:', START.isoformat())
    print('check_now:', now.isoformat())
    print('completed_draws_since_start:', len(after))
    print('latest_draw:', latest['id'], latest['dt'].isoformat(), latest['result'], latest['odd'], latest['even'])
    print('max_without_MONA_since_start:', max_no_odd_after, 'at', max_no_odd_row['id'] if max_no_odd_row else None, max_no_odd_row['dt'].isoformat() if max_no_odd_row else None)
    print('max_without_ZYGA_since_start:', max_no_even_after, 'at', max_no_even_row['id'] if max_no_even_row else None, max_no_even_row['dt'].isoformat() if max_no_even_row else None)
    print('alert_12_crossings:', len(crossings))
    for kind, r, streak in crossings:
        print('ALERT_SHOULD_HAVE_FIRED:', kind, 'streak', streak, 'draw', r['id'], r['dt'].isoformat(), 'result', r['result'], f"{r['odd']}-{r['even']}")

    if crossings:
        raise SystemExit(12)

if __name__ == '__main__':
    main()
