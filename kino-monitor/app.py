from __future__ import annotations

import json
import os
import queue
import sqlite3
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests
import tkinter as tk
from tkinter import ttk, messagebox

try:
    from winotify import Notification, audio
except Exception:
    Notification = None
    audio = None

APP_NAME = "KINO Monitor"
GAME_ID = 1100
API_LAST = f"https://api.opap.gr/draws/v3.0/{GAME_ID}/last-result-and-active?status=results"
API_DAY = f"https://api.opap.gr/draws/v3.0/{GAME_ID}/draw-date/{{date}}/{{date}}?size=300"
CHECK_MINUTE_MOD = 1
CHECK_SECOND = 5
ALERT_THRESHOLD = 2
REQUEST_TIMEOUT = 20


def data_dir() -> Path:
    base = os.getenv("LOCALAPPDATA") or str(Path.home())
    p = Path(base) / "KinoMonitor"
    p.mkdir(parents=True, exist_ok=True)
    return p

DB_PATH = data_dir() / "kino_monitor.sqlite3"
CONFIG_PATH = data_dir() / "config.json"


@dataclass(frozen=True)
class Draw:
    draw_id: int
    draw_time_ms: int
    numbers: tuple[int, ...]

    @property
    def odd_count(self) -> int:
        return sum(1 for n in self.numbers if n % 2)

    @property
    def even_count(self) -> int:
        return len(self.numbers) - self.odd_count

    @property
    def result(self) -> str:
        if self.odd_count > self.even_count:
            return "ΜΟΝΑ"
        if self.even_count > self.odd_count:
            return "ΖΥΓΑ"
        return "ΙΣΟΠΑΛΙΑ"

    @property
    def local_dt(self) -> datetime:
        return datetime.fromtimestamp(self.draw_time_ms / 1000)


class Store:
    def __init__(self, path: Path):
        self.path = path
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        with self.conn:
            self.conn.execute(
                """
                CREATE TABLE IF NOT EXISTS draws (
                    draw_id INTEGER PRIMARY KEY,
                    draw_time_ms INTEGER NOT NULL,
                    draw_time_local TEXT NOT NULL,
                    numbers TEXT NOT NULL,
                    odd_count INTEGER NOT NULL,
                    even_count INTEGER NOT NULL,
                    result TEXT NOT NULL,
                    inserted_at TEXT NOT NULL
                )
                """
            )
            self.conn.execute("CREATE INDEX IF NOT EXISTS idx_draw_time ON draws(draw_time_ms)")

    def save(self, draw: Draw) -> bool:
        with self.lock, self.conn:
            cur = self.conn.execute(
                """
                INSERT OR IGNORE INTO draws
                (draw_id, draw_time_ms, draw_time_local, numbers, odd_count, even_count, result, inserted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    draw.draw_id,
                    draw.draw_time_ms,
                    draw.local_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    ",".join(map(str, draw.numbers)),
                    draw.odd_count,
                    draw.even_count,
                    draw.result,
                    datetime.now().isoformat(timespec="seconds"),
                ),
            )
            return cur.rowcount > 0

    def recent(self, limit: int = 50):
        with self.lock:
            return self.conn.execute(
                "SELECT * FROM draws ORDER BY draw_id DESC LIMIT ?", (limit,)
            ).fetchall()

    def latest_draw_id(self) -> Optional[int]:
        with self.lock:
            row = self.conn.execute("SELECT MAX(draw_id) AS m FROM draws").fetchone()
            return int(row["m"]) if row and row["m"] is not None else None

    def streaks(self) -> tuple[int, int, int]:
        rows = self.recent(500)
        no_odd = no_even = ties = 0
        for r in rows:
            if r["result"] == "ΜΟΝΑ":
                break
            no_odd += 1
        for r in rows:
            if r["result"] == "ΖΥΓΑ":
                break
            no_even += 1
        for r in rows:
            if r["result"] != "ΙΣΟΠΑΛΙΑ":
                break
            ties += 1
        return no_odd, no_even, ties


class OpapClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "KinoMonitor/1.0 (Windows; personal results monitor)",
            "Accept": "application/json",
        })

    @staticmethod
    def _parse_draw(obj: dict) -> Draw:
        nums = obj.get("winningNumbers", {}).get("list") or []
        if len(nums) != 20:
            raise ValueError(f"Expected 20 numbers, got {len(nums)}")
        return Draw(
            draw_id=int(obj["drawId"]),
            draw_time_ms=int(obj["drawTime"]),
            numbers=tuple(int(n) for n in nums),
        )

    def completed_today(self) -> list[Draw]:
        ds = datetime.now().strftime("%Y-%m-%d")
        r = self.session.get(API_DAY.format(date=ds), timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        content = data.get("content", []) if isinstance(data, dict) else []
        draws = []
        for obj in content:
            if obj.get("winningNumbers", {}).get("list"):
                try:
                    draws.append(self._parse_draw(obj))
                except Exception:
                    pass
        return sorted(draws, key=lambda d: d.draw_id)

    def latest(self) -> Draw:
        last_error = None
        try:
            r = self.session.get(API_LAST, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            data = r.json()
            obj = data.get("last") if isinstance(data, dict) else None
            if obj and obj.get("status") == "results":
                return self._parse_draw(obj)
            if obj and obj.get("winningNumbers"):
                return self._parse_draw(obj)
        except Exception as e:
            last_error = e

        ds = datetime.now().strftime("%Y-%m-%d")
        try:
            r = self.session.get(API_DAY.format(date=ds), timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            data = r.json()
            content = data.get("content", []) if isinstance(data, dict) else []
            valid = [x for x in content if x.get("winningNumbers", {}).get("list")]
            if not valid:
                raise RuntimeError("No completed draws returned for today")
            obj = max(valid, key=lambda x: int(x.get("drawId", 0)))
            return self._parse_draw(obj)
        except Exception as e:
            raise RuntimeError(f"OPAP API error. Primary: {last_error}; fallback: {e}") from e


class Notifier:
    def __init__(self):
        self.last_alert_key: Optional[str] = None

    def send(self, title: str, msg: str):
        if sys.platform == "win32" and Notification is not None:
            toast = Notification(app_id=APP_NAME, title=title, msg=msg, duration="long")
            try:
                if audio is not None:
                    toast.set_audio(audio.Default, loop=False)
            except Exception:
                pass
            toast.show()
        else:
            print(f"NOTIFICATION: {title} - {msg}")


class MonitorEngine:
    def __init__(self, store: Store, event_queue: queue.Queue):
        self.store = store
        self.client = OpapClient()
        self.notifier = Notifier()
        self.event_queue = event_queue
        self.stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None
        self.alerted_odd_absence = False
        self.alerted_even_absence = False

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()

    @staticmethod
    def seconds_to_next_slot(now: Optional[datetime] = None) -> float:
        now = now or datetime.now()
        candidate = now.replace(second=CHECK_SECOND, microsecond=0)
        if candidate <= now:
            candidate += timedelta(minutes=1)
        while candidate.minute % 5 != CHECK_MINUTE_MOD:
            candidate += timedelta(minutes=1)
        return max(0.2, (candidate - now).total_seconds())

    def _loop(self):
        self.event_queue.put(("status", "Ενεργό — αναμονή για την επόμενη κλήρωση"))
        self._seed_recent_history()
        self._check_with_retries(initial=True)
        while not self.stop_event.is_set():
            wait = self.seconds_to_next_slot()
            if self.stop_event.wait(wait):
                break
            self._check_with_retries(initial=False)

    def _seed_recent_history(self):
        try:
            draws = self.client.completed_today()
            for draw in draws[-50:]:
                self.store.save(draw)
            if draws:
                self.event_queue.put(("status", f"Φορτώθηκαν οι τελευταίες {min(50, len(draws))} κληρώσεις της ημέρας"))
                self.event_queue.put(("refresh", None))
        except Exception as e:
            self.event_queue.put(("error", f"Αρχικό ιστορικό: {e}"))

    def _backfill_if_gap(self, latest: Draw, previous: Optional[int]):
        if previous is None or latest.draw_id <= previous + 1:
            return []
        try:
            draws = self.client.completed_today()
            return [d for d in draws if previous < d.draw_id <= latest.draw_id]
        except Exception:
            return []

    def _check_with_retries(self, initial: bool):
        previous = self.store.latest_draw_id()
        attempts = 1 if initial else 5
        for attempt in range(attempts):
            if self.stop_event.is_set():
                return
            try:
                draw = self.client.latest()
                missing = self._backfill_if_gap(draw, previous)
                if missing:
                    for item in missing:
                        if self.store.save(item):
                            self._after_new_draw(item)
                    return
                is_new = self.store.save(draw)
                if is_new:
                    self._after_new_draw(draw)
                    return
                if not initial and previous == draw.draw_id and attempt < attempts - 1:
                    self.event_queue.put(("status", f"Η νέα κλήρωση δεν δημοσιεύτηκε ακόμη — επανάληψη {attempt+1}/4"))
                    self.stop_event.wait(15)
                    continue
                self.event_queue.put(("status", f"Έλεγχος OK — τελευταία κλήρωση #{draw.draw_id}"))
                self.event_queue.put(("refresh", None))
                return
            except Exception as e:
                self.event_queue.put(("error", str(e)))
                if attempt < attempts - 1:
                    self.stop_event.wait(15)
        self.event_queue.put(("status", "Αποτυχία ανάκτησης — θα ξαναδοκιμάσει στον επόμενο κύκλο"))

    def _after_new_draw(self, draw: Draw):
        no_odd, no_even, ties = self.store.streaks()
        alerts = []

        if no_odd > ALERT_THRESHOLD:
            if not self.alerted_odd_absence:
                alerts.append(f"{no_odd} συνεχόμενες κληρώσεις χωρίς αποτέλεσμα ΜΟΝΑ")
                self.alerted_odd_absence = True
        else:
            self.alerted_odd_absence = False

        if no_even > ALERT_THRESHOLD:
            if not self.alerted_even_absence:
                alerts.append(f"{no_even} συνεχόμενες κληρώσεις χωρίς αποτέλεσμα ΖΥΓΑ")
                self.alerted_even_absence = True
        else:
            self.alerted_even_absence = False

        if alerts:
            self.notifier.send(
                "KINO — ειδοποίηση streak",
                " • ".join(alerts) + f". Τελευταία κλήρωση #{draw.draw_id}: {draw.result} ({draw.odd_count}-{draw.even_count}).",
            )

        self.event_queue.put(("new_draw", draw))
        self.event_queue.put(("status", f"Νέα κλήρωση #{draw.draw_id}: {draw.result} — Μονά {draw.odd_count}, Ζυγά {draw.even_count}"))
        self.event_queue.put(("refresh", None))


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_NAME)
        self.geometry("1120x650")
        self.minsize(900, 520)
        self.store = Store(DB_PATH)
        self.events: queue.Queue = queue.Queue()
        self.engine = MonitorEngine(self.store, self.events)
        self.protocol("WM_DELETE_WINDOW", self.on_close)

        self.status_var = tk.StringVar(value="Εκκίνηση…")
        self.latest_var = tk.StringVar(value="—")
        self.no_odd_var = tk.StringVar(value="0")
        self.no_even_var = tk.StringVar(value="0")
        self.ties_var = tk.StringVar(value="0")
        self.next_check_var = tk.StringVar(value="—")

        self._build_ui()
        self.refresh_table()
        self.after(250, self._poll_events)
        self.after(1000, self._update_next_check)
        self.engine.start()

    def _build_ui(self):
        top = ttk.Frame(self, padding=12)
        top.pack(fill="x")
        ttk.Label(top, text="KINO Monitor", font=("Segoe UI", 20, "bold")).pack(side="left")
        ttk.Button(top, text="Έλεγχος τώρα", command=self.check_now).pack(side="right", padx=4)
        ttk.Button(top, text="Δοκιμή ειδοποίησης", command=self.test_notification).pack(side="right", padx=4)

        info = ttk.Frame(self, padding=(12, 0, 12, 8))
        info.pack(fill="x")
        cards = [
            ("Τελευταία", self.latest_var),
            ("Χωρίς ΜΟΝΑ", self.no_odd_var),
            ("Χωρίς ΖΥΓΑ", self.no_even_var),
            ("Συνεχόμενες ΙΣΟΠΑΛΙΕΣ", self.ties_var),
            ("Επόμενος έλεγχος", self.next_check_var),
        ]
        for title, var in cards:
            f = ttk.LabelFrame(info, text=title, padding=8)
            f.pack(side="left", expand=True, fill="x", padx=3)
            ttk.Label(f, textvariable=var, font=("Segoe UI", 12, "bold")).pack()

        cols = ("draw", "date", "time", "result", "odd", "even", "numbers")
        self.tree = ttk.Treeview(self, columns=cols, show="headings", height=20)
        headings = {
            "draw": "Κλήρωση", "date": "Ημερομηνία", "time": "Ώρα", "result": "Αποτέλεσμα",
            "odd": "Μονά", "even": "Ζυγά", "numbers": "20 αριθμοί"
        }
        widths = {"draw": 90, "date": 100, "time": 75, "result": 100, "odd": 55, "even": 55, "numbers": 560}
        for c in cols:
            self.tree.heading(c, text=headings[c])
            self.tree.column(c, width=widths[c], anchor="center" if c != "numbers" else "w")
        self.tree.pack(fill="both", expand=True, padx=12, pady=(0, 8))

        bottom = ttk.Frame(self, padding=(12, 0, 12, 12))
        bottom.pack(fill="x")
        ttk.Label(bottom, textvariable=self.status_var).pack(side="left")
        ttk.Label(bottom, text=f"Βάση: {DB_PATH}").pack(side="right")

    def refresh_table(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        rows = self.store.recent(100)
        for r in rows:
            dt = datetime.fromisoformat(r["draw_time_local"])
            self.tree.insert("", "end", values=(
                r["draw_id"], dt.strftime("%d/%m/%Y"), dt.strftime("%H:%M:%S"), r["result"],
                r["odd_count"], r["even_count"], r["numbers"].replace(",", "  ")
            ))
        if rows:
            r = rows[0]
            self.latest_var.set(f"#{r['draw_id']} — {r['result']}")
        no_odd, no_even, ties = self.store.streaks()
        self.no_odd_var.set(str(no_odd))
        self.no_even_var.set(str(no_even))
        self.ties_var.set(str(ties))

    def _poll_events(self):
        try:
            while True:
                kind, payload = self.events.get_nowait()
                if kind == "status":
                    self.status_var.set(payload)
                elif kind == "error":
                    self.status_var.set("Σφάλμα API: " + payload[:160])
                elif kind == "refresh":
                    self.refresh_table()
        except queue.Empty:
            pass
        self.after(250, self._poll_events)

    def _update_next_check(self):
        secs = self.engine.seconds_to_next_slot()
        target = datetime.now() + timedelta(seconds=secs)
        self.next_check_var.set(target.strftime("%H:%M:%S"))
        self.after(1000, self._update_next_check)

    def check_now(self):
        threading.Thread(target=self.engine._check_with_retries, args=(True,), daemon=True).start()

    def test_notification(self):
        self.engine.notifier.send("KINO Monitor", "Οι ειδοποιήσεις των Windows λειτουργούν κανονικά.")

    def on_close(self):
        self.engine.stop()
        self.destroy()


if __name__ == "__main__":
    App().mainloop()
