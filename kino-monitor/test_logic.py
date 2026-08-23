from datetime import datetime
from app import Draw, MonitorEngine


def test_results():
    d = Draw(1, 1_700_000_000_000, tuple(list(range(1, 20, 2)) + [21] + list(range(2, 20, 2))))
    assert len(d.numbers) == 20
    assert d.odd_count == 11 and d.even_count == 9 and d.result == "ΜΟΝΑ"

    tie = Draw(2, 1_700_000_000_000, tuple(range(1, 21)))
    assert tie.odd_count == 10 and tie.even_count == 10 and tie.result == "ΙΣΟΠΑΛΙΑ"


def test_schedule():
    now = datetime(2026, 8, 23, 9, 0, 30)
    assert 34 <= MonitorEngine.seconds_to_next_slot(now) <= 36
    now = datetime(2026, 8, 23, 9, 1, 6)
    assert 298 <= MonitorEngine.seconds_to_next_slot(now) <= 300


if __name__ == "__main__":
    test_results()
    test_schedule()
    print("OK")
