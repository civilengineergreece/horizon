from __future__ import annotations

import webbrowser
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox

import app as core

# The core alerts when streak > ALERT_THRESHOLD.
# Setting 11 means: no alert for 1..11; first alert exactly on draw 12.
core.ALERT_THRESHOLD = 11


class EnhancedEmailSettingsDialog(core.EmailSettingsDialog):
    """Email settings with plain-language Google App Password help."""
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Ρυθμίσεις email — KINO Monitor")

        help_frame = ttk.LabelFrame(self, text="Βοήθεια για App Password", padding=10)
        help_frame.pack(fill="x", padx=16, pady=(0, 14))
        ttk.Label(
            help_frame,
            text=(
                "Το App Password ΔΕΝ είναι ο κανονικός κωδικός Gmail. Είναι ξεχωριστός "
                "κωδικός 16 χαρακτήρων που δημιουργεί η Google για το KINO Monitor."
            ),
            wraplength=560,
        ).pack(anchor="w")
        buttons = ttk.Frame(help_frame)
        buttons.pack(fill="x", pady=(8, 0))
        ttk.Button(buttons, text="Τι είναι;", command=self._show_help).pack(side="left")
        ttk.Button(
            buttons,
            text="Άνοιγμα Google App Passwords",
            command=lambda: webbrowser.open("https://myaccount.google.com/apppasswords"),
        ).pack(side="left", padx=8)

    def _show_help(self):
        messagebox.showinfo(
            "Google App Password",
            "Το App Password είναι ξεχωριστός κωδικός 16 χαρακτήρων της Google.\n\n"
            "1. Ενεργοποίησε Επαλήθευση σε 2 βήματα.\n"
            "2. Πάτησε «Άνοιγμα Google App Passwords».\n"
            "3. Δημιούργησε κωδικό με όνομα KINO Monitor.\n"
            "4. Αντέγραψέ τον στο πεδίο Gmail App Password.\n\n"
            "Δεν χρησιμοποιούμε τον κανονικό κωδικό Gmail και ο App Password δεν ανεβαίνει στο GitHub.",
            parent=self,
        )


core.EmailSettingsDialog = EnhancedEmailSettingsDialog


class OneScreenApp(core.App):
    """Single-window KINO monitor with live summary and full history."""

    def __init__(self):
        super().__init__()
        self.title("KINO Monitor v1.3 — 1 οθόνη")
        self.geometry("1220x860")
        self.minsize(1000, 700)

    def _build_ui(self):
        self.live_draw_var = tk.StringVar(value="Αναμονή για κλήρωση…")
        self.live_result_var = tk.StringVar(value="—")
        self.live_counts_var = tk.StringVar(value="Μονά —  |  Ζυγά —")
        self.live_numbers_var = tk.StringVar(value="—")
        self.live_streak_var = tk.StringVar(value="Χωρίς ΜΟΝΑ: 0   |   Χωρίς ΖΥΓΑ: 0   |   Ισοπαλίες: 0")

        super()._build_ui()

        live = ttk.LabelFrame(self, text="LIVE — τελευταία κλήρωση", padding=12)
        live.pack(fill="x", padx=12, pady=(0, 10), before=self.tree)

        row1 = ttk.Frame(live)
        row1.pack(fill="x")
        left = ttk.Frame(row1)
        left.pack(side="left", fill="x", expand=True)
        ttk.Label(left, textvariable=self.live_draw_var, font=("Segoe UI", 13, "bold")).pack(anchor="w")
        ttk.Label(left, textvariable=self.live_counts_var, font=("Segoe UI", 12)).pack(anchor="w", pady=(3, 0))

        result_box = ttk.LabelFrame(row1, text="Αποτέλεσμα", padding=8)
        result_box.pack(side="right", padx=(12, 0))
        ttk.Label(
            result_box,
            textvariable=self.live_result_var,
            font=("Segoe UI", 24, "bold"),
            width=12,
            anchor="center",
        ).pack()

        ttk.Label(
            live,
            textvariable=self.live_numbers_var,
            font=("Segoe UI", 14, "bold"),
            wraplength=1130,
        ).pack(fill="x", pady=(10, 6))

        streak_box = ttk.Frame(live)
        streak_box.pack(fill="x")
        ttk.Label(streak_box, textvariable=self.live_streak_var, font=("Segoe UI", 13, "bold")).pack(side="left")
        ttk.Label(
            streak_box,
            text="Email alert: στην 12η συνεχόμενη κλήρωση χωρίς ΜΟΝΑ ή χωρίς ΖΥΓΑ",
            font=("Segoe UI", 10),
        ).pack(side="right")

    def refresh_table(self):
        super().refresh_table()
        rows = self.store.recent(1)
        if rows:
            r = rows[0]
            dt = datetime.fromisoformat(r["draw_time_local"])
            self.live_draw_var.set(f"Κλήρωση #{r['draw_id']} — {dt.strftime('%d/%m/%Y %H:%M:%S')}")
            self.live_result_var.set(r["result"])
            self.live_counts_var.set(f"Μονά {r['odd_count']}   |   Ζυγά {r['even_count']}")
            numbers = r["numbers"].split(",")
            self.live_numbers_var.set("20 αριθμοί:  " + "   ".join(numbers))
        else:
            self.live_draw_var.set("Αναμονή για την πρώτη κλήρωση…")
            self.live_result_var.set("—")
            self.live_counts_var.set("Μονά —  |  Ζυγά —")
            self.live_numbers_var.set("—")

        no_odd, no_even, ties = self.store.streaks()
        self.live_streak_var.set(
            f"Χωρίς ΜΟΝΑ: {no_odd}   |   Χωρίς ΖΥΓΑ: {no_even}   |   Ισοπαλίες: {ties}"
        )


if __name__ == "__main__":
    OneScreenApp().mainloop()
