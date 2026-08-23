from datetime import datetime
from app import Draw, EmailNotifier, MonitorEngine, valid_email


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


def test_email_helpers():
    assert valid_email("a@example.com")
    assert not valid_email("bad")
    d = Draw(123, 1_700_000_000_000, tuple(range(1, 21)))
    subject, body = EmailNotifier.build_alert(d, ["3 συνεχόμενες κληρώσεις χωρίς αποτέλεσμα ΜΟΝΑ"], 3, 0, 0)
    assert "KINO ALERT" in subject
    assert "#123" in body and "Χωρίς ΜΟΝΑ: 3" in body


if __name__ == "__main__":
    test_results(); test_schedule(); test_email_helpers(); print("OK")
