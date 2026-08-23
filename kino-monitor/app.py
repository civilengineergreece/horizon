from __future__ import annotations

import base64
import ctypes
import json
import os
import queue
import smtplib
import sqlite3
import ssl
import threading
from ctypes import wintypes
from dataclasses import dataclass
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

import requests
import tkinter as tk
from tkinter import ttk, messagebox

APP_NAME = "KINO Monitor"
GAME_ID = 1100
API_LAST = f"https://api.opap.gr/draws/v3.0/{GAME_ID}/last-result-and-active?status=results"
API_DAY = f"https://api.opap.gr/draws/v3.0/{GAME_ID}/draw-date/{{date}}/{{date}}?size=300"
CHECK_MINUTE_MOD = 1
CHECK_SECOND = 5
ALERT_THRESHOLD = 2
REQUEST_TIMEOUT = 20
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def data_dir() -> Path:
    base = os.getenv("LOCALAPPDATA") or str(Path.home())
    p = Path(base) / "KinoMonitor"
    p.mkdir(parents=True, exist_ok=True)
    return p


DB_PATH = data_dir() / "kino_monitor.sqlite3"
CONFIG_PATH = data_dir() / "config.json"


class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _blob_from_bytes(data: bytes):
    buf = ctypes.create_string_buffer(data)
    blob = DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_byte)))
    return blob, buf


def protect_secret(secret: str) -> str:
    """Protect a secret with Windows DPAPI for the current Windows user."""
    if os.name != "nt":
        raise RuntimeError("Η ασφαλής αποθήκευση κωδικού υποστηρίζεται μόνο στα Windows.")
    raw = secret.encode("utf-8")
    in_blob, _buf = _blob_from_bytes(raw)
    out_blob = DATA_BLOB()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    if not crypt32.CryptProtectData(ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)):
        raise ctypes.WinError()
    try:
        protected = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        return base64.b64encode(protected).decode("ascii")
    finally:
        kernel32.LocalFree(out_blob.pbData)


def unprotect_secret(value: str) -> str:
    if not value:
        return ""
    if os.name != "nt":
        raise RuntimeError("Η αποκρυπτογράφηση κωδικού υποστηρίζεται μόνο στα Windows.")
    encrypted = base64.b64decode(value.encode("ascii"))
    in_blob, _buf = _blob_from_bytes(encrypted)
    out_blob = DATA_BLOB()
    crypt32 = ctypes.windll.crypt32
    kernel32 = ctypes.windll.kernel32
    if not crypt32.CryptUnprotectData(ctypes.byref(in_blob), None, None, None, None, 0, ctypes.byref(out_blob)):
        raise ctypes.WinError()
    try:
        raw = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        return raw.decode("utf-8")
    finally:
        kernel32.LocalFree(out_blob.pbData)


def valid_email(value: str) -> bool:
    value = value.strip()
    return "@" in value and "." in value.rsplit("@", 1)[-1] and " " not in value


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


@dataclass(frozen=True)
class EmailSettings:
    sender: str
    recipient1: str
    recipient2: str
    app_password: str

    @property
    def recipients(self) -> tuple[str, str]:
        return self.recipient1, self.recipient2


class ConfigStore:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()

    def _load_raw(self) -> dict:
        if not self.path.exists():
            return {}
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def public_fields(self) -> dict:
        with self.lock:
            raw = self._load_raw()
        return {
            "sender": raw.get("sender", ""),
            "recipient1": raw.get("recipient1", ""),
            "recipient2": raw.get("recipient2", ""),
            "has_password": bool(raw.get("app_password_dpapi")),
        }

    def save(self, sender: str, recipient1: str, recipient2: str, app_password: str = ""):
        sender = sender.strip()
        recipient1 = recipient1.strip()
        recipient2 = recipient2.strip()
        if not all(valid_email(x) for x in (sender, recipient1, recipient2)):
            raise ValueError("Συμπλήρωσε έγκυρες διευθύνσεις email και στα τρία πεδία.")
        with self.lock:
            raw = self._load_raw()
            if app_password.strip():
                raw["app_password_dpapi"] = protect_secret(app_password.replace(" ", "").strip())
            elif not raw.get("app_password_dpapi"):
                raise ValueError("Χρειάζεται App Password Gmail στην πρώτη ρύθμιση.")
            raw.update({"sender": sender, "recipient1": recipient1, "recipient2": recipient2})
            self.path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")

    def load_email_settings(self) -> EmailSettings:
        with self.lock:
            raw = self._load_raw()
        sender = str(raw.get("sender", "")).strip()
        r1 = str(raw.get("recipient1", "")).strip()
        r2 = str(raw.get("recipient2", "")).strip()
        protected = str(raw.get("app_password_dpapi", "")).strip()
        if not all(valid_email(x) for x in (sender, r1, r2)) or not protected:
            raise RuntimeError("Δεν έχουν ολοκληρωθεί οι Ρυθμίσεις email.")
        return EmailSettings(sender, r1, r2, unprotect_secret(protected))


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
            return self.conn.execute("SELECT * FROM draws ORDER BY draw_id DESC LIMIT ?", (limit,)).fetchall()

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
            "User-Agent": "KinoMonitor/1.1 (Windows; personal results monitor)",
            "Accept": "application/json",
        })

    @staticmethod
    def _parse_draw(obj: dict) -> Draw:
        nums = obj.get("winningNumbers", {}).get("list") or []
        if len(nums) != 20:
            raise ValueError(f"Expected 20 numbers, got {len(nums)}")
        return Draw(int(obj["drawId"]), int(obj["drawTime"]), tuple(int(n) for n in nums))

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
            if obj and (obj.get("status") == "results" or obj.get("winningNumbers")):
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
            return self._parse_draw(max(valid, key=lambda x: int(x.get("drawId", 0))))
        except Exception as e:
            raise RuntimeError(f"OPAP API error. Primary: {last_error}; fallback: {e}") from e


class EmailNotifier:
    def __init__(self, config: ConfigStore, event_queue: queue.Queue):
        self.config = config
        self.event_queue = event_queue

    @staticmethod
    def build_alert(draw: Draw, alerts: list[str], no_odd: int, no_even: int, ties: int) -> tuple[str, str]:
        if len(alerts) == 1:
            subject = f"KINO ALERT — {alerts[0]}"
        else:
            subject = "KINO ALERT — streak ΜΟΝΑ / ΖΥΓΑ"
        body = (
            "KINO Monitor\n\n"
            + "\n".join(f"• {a}" for a in alerts)
            + "\n\n"
            + f"Κλήρωση: #{draw.draw_id}\n"
            + f"Ημερομηνία/ώρα: {draw.local_dt.strftime('%d/%m/%Y %H:%M:%S')}\n"
            + f"Αποτέλεσμα: {draw.result}\n"
            + f"Μονά: {draw.odd_count} | Ζυγά: {draw.even_count}\n"
            + f"Χωρίς ΜΟΝΑ: {no_odd}\n"
            + f"Χωρίς ΖΥΓΑ: {no_even}\n"
            + f"Συνεχόμενες ΙΣΟΠΑΛΙΕΣ: {ties}\n\n"
            + "Οι κληρώσεις είναι ανεξάρτητες· το streak δεν προβλέπει το επόμενο αποτέλεσμα."
        )
        return subject, body

    def send(self, subject: str, body: str) -> None:
        settings = self.config.load_email_settings()
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30) as smtp:
            smtp.login(settings.sender, settings.app_password)
            for recipient in settings.recipients:
                msg = EmailMessage()
                msg["From"] = settings.sender
                msg["To"] = recipient
                msg["Subject"] = subject
                msg.set_content(body)
                smtp.send_message(msg)
        self.event_queue.put(("email_ok", f"Email στάλθηκε και στους 2 παραλήπτες: {settings.recipient1}, {settings.recipient2}"))

    def send_test(self) -> None:
        settings = self.config.load_email_settings()
        body = (
            "Το KINO Monitor είναι ρυθμισμένο σωστά.\n\n"
            f"Αποστολέας: {settings.sender}\n"
            "Το δοκιμαστικό μήνυμα αποστέλλεται ξεχωριστά και στους δύο παραλήπτες."
        )
        self.send("KINO Monitor — δοκιμή email", body)


class MonitorEngine:
    def __init__(self, store: Store, event_queue: queue.Queue, config: ConfigStore):
        self.store = store
        self.client = OpapClient()
        self.emailer = EmailNotifier(config, event_queue)
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
                if self.store.save(draw):
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
        odd_trigger = no_odd > ALERT_THRESHOLD and not self.alerted_odd_absence
        even_trigger = no_even > ALERT_THRESHOLD and not self.alerted_even_absence

        if no_odd <= ALERT_THRESHOLD:
            self.alerted_odd_absence = False
        if no_even <= ALERT_THRESHOLD:
            self.alerted_even_absence = False

        if odd_trigger:
            alerts.append(f"{no_odd} συνεχόμενες κληρώσεις χωρίς αποτέλεσμα ΜΟΝΑ")
        if even_trigger:
            alerts.append(f"{no_even} συνεχόμενες κληρώσεις χωρίς αποτέλεσμα ΖΥΓΑ")

        if alerts:
            subject, body = self.emailer.build_alert(draw, alerts, no_odd, no_even, ties)
            try:
                self.emailer.send(subject, body)
                if odd_trigger:
                    self.alerted_odd_absence = True
                if even_trigger:
                    self.alerted_even_absence = True
            except Exception as e:
                self.event_queue.put(("email_error", f"Αποτυχία αποστολής email: {e}"))

        self.event_queue.put(("new_draw", draw))
        self.event_queue.put(("status", f"Νέα κλήρωση #{draw.draw_id}: {draw.result} — Μονά {draw.odd_count}, Ζυγά {draw.even_count}"))
        self.event_queue.put(("refresh", None))


class EmailSettingsDialog(tk.Toplevel):
    def __init__(self, parent: "App"):
        super().__init__(parent)
        self.parent = parent
        self.title("Ρυθμίσεις email")
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        current = parent.config_store.public_fields()

        frame = ttk.Frame(self, padding=16)
        frame.pack(fill="both", expand=True)

        self.sender = tk.StringVar(value=current["sender"])
        self.r1 = tk.StringVar(value=current["recipient1"])
        self.r2 = tk.StringVar(value=current["recipient2"])
        self.password = tk.StringVar(value="")

        fields = [
            ("Gmail αποστολέα", self.sender, False),
            ("Παραλήπτης 1", self.r1, False),
            ("Παραλήπτης 2", self.r2, False),
            ("Gmail App Password", self.password, True),
        ]
        for row, (label, var, secret) in enumerate(fields):
            ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", padx=(0, 10), pady=5)
            entry = ttk.Entry(frame, textvariable=var, width=42, show="•" if secret else "")
            entry.grid(row=row, column=1, sticky="ew", pady=5)

        pwd_note = "Άφησέ το κενό για να κρατήσεις τον ήδη αποθηκευμένο κωδικό." if current["has_password"] else "Χρησιμοποίησε 16ψήφιο App Password Google, όχι τον κανονικό κωδικό Gmail."
        ttk.Label(frame, text=pwd_note, wraplength=430).grid(row=4, column=0, columnspan=2, sticky="w", pady=(2, 10))
        ttk.Label(frame, text="Ο κωδικός προστατεύεται με Windows DPAPI και δεν αποθηκεύεται στο GitHub.", wraplength=430).grid(row=5, column=0, columnspan=2, sticky="w", pady=(0, 12))

        buttons = ttk.Frame(frame)
        buttons.grid(row=6, column=0, columnspan=2, sticky="e")
        ttk.Button(buttons, text="Ακύρωση", command=self.destroy).pack(side="right", padx=4)
        ttk.Button(buttons, text="Αποθήκευση", command=self.save).pack(side="right", padx=4)

    def save(self):
        try:
            self.parent.config_store.save(self.sender.get(), self.r1.get(), self.r2.get(), self.password.get())
        except Exception as e:
            messagebox.showerror("Ρυθμίσεις email", str(e), parent=self)
            return
        self.parent.status_var.set("Οι ρυθμίσεις email αποθηκεύτηκαν.")
        self.destroy()


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_NAME)
        self.geometry("1140x680")
        self.minsize(920, 540)
        self.store = Store(DB_PATH)
        self.config_store = ConfigStore(CONFIG_PATH)
        self.events: queue.Queue = queue.Queue()
        self.engine = MonitorEngine(self.store, self.events, self.config_store)
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
        ttk.Button(top, text="Δοκιμή email", command=self.test_email).pack(side="right", padx=4)
        ttk.Button(top, text="Ρυθμίσεις email", command=self.open_email_settings).pack(side="right", padx=4)

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
            "odd": "Μονά", "even": "Ζυγά", "numbers": "20 αριθμοί",
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
                r["odd_count"], r["even_count"], r["numbers"].replace(",", "  "),
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
                elif kind == "email_error":
                    self.status_var.set(payload[:180])
                elif kind == "email_ok":
                    self.status_var.set(payload)
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

    def open_email_settings(self):
        EmailSettingsDialog(self)

    def test_email(self):
        def worker():
            try:
                self.engine.emailer.send_test()
            except Exception as e:
                self.events.put(("email_error", f"Αποτυχία δοκιμαστικού email: {e}"))
        threading.Thread(target=worker, daemon=True).start()

    def on_close(self):
        self.engine.stop()
        self.destroy()


if __name__ == "__main__":
    App().mainloop()
