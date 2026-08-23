from __future__ import annotations

import webbrowser
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox

import app as core


class EnhancedEmailSettingsDialog(core.EmailSettingsDialog):
    """Adds plain-language App Password help to the existing email settings."""
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Ρυθμίσεις email — KINO Monitor")
        self.geometry("620x410")

        help_frame = ttk.LabelFrame(self, text="Βοήθεια για App Password", padding=10)
        help_frame.pack(fill="x", padx=16, pady=(0, 14))
        ttk.Label(
            help_frame,
            text=(
                "Το App Password ΔΕΝ είναι ο κανονικός κωδικός Gmail. Είναι ένας ξεχωριστός "
                "κωδικός 16 χαρακτήρων που δημιουργεί η Google μόνο για το KINO Monitor."
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
            "Τι είναι:\n"
            "Ένας ξεχωριστός κωδικός 16 χαρακτήρων που δημιουργεί η Google για το KINO Monitor. "
            "Δεν δίνεις στο πρόγραμμα τον κανονικό κωδικό Gmail.\n\n"
            "Πώς τον δημιουργείς:\n"
            "1. Ενεργοποιείς Επαλήθευση σε 2 βήματα στον Google λογαριασμό.\n"
            "2. Πατάς «Άνοιγμα Google App Passwords».\n"
            "3. Συνδέεσαι στον Gmail λογαριασμό που θα στέλνει τα alerts.\n"
            "4. Δημιουργείς App Password με όνομα π.χ. KINO Monitor.\n"
            "5. Αντιγράφεις τον κωδικό που σου εμφανίζει η Google στο πεδίο App Password.\n\n"
            "Ο κωδικός αποθηκεύεται προστατευμένος τοπικά στα Windows και όχι στο GitHub.",
            parent=self,
        )


core.EmailSettingsDialog = EnhancedEmailSettingsDialog


class LiveResultsWindow(tk.Toplevel):
    def __init__(self, parent: "LiveApp"):
        super().__init__(parent)
        self.parent = parent
        self.title("KINO Monitor — Live Αποτελέσματα")
        self.geometry("1000x740")
        self.minsize(840, 620)
        self.protocol("WM_DELETE_WINDOW", self.withdraw)

        self.draw_var = tk.StringVar(value="Αναμονή για κλήρωση…")
        self.result_var = tk.StringVar(value="—")
        self.count_var = tk.StringVar(value="Μονά —  |  Ζυγά —")
        self.streak_var = tk.StringVar(value="Χωρίς ΜΟΝΑ: 0   |   Χωρίς ΖΥΓΑ: 0   |   Ισοπαλίες: 0")
        self.status_var = tk.StringVar(value="Σύνδεση με OPAP…")
        self.number_vars = [tk.StringVar(value="—") for _ in range(20)]
        self.recent_vars = [tk.StringVar(value="") for _ in range(12)]
        self.topmost_var = tk.BooleanVar(value=False)

        self._build()
        self.refresh()
        self.after(1000, self._heartbeat)

    def show(self):
        self.deiconify()
        self.lift()
        self.refresh()

    def _toggle_topmost(self):
        self.attributes("-topmost", bool(self.topmost_var.get()))

    def _build(self):
        outer = ttk.Frame(self, padding=18)
        outer.pack(fill="both", expand=True)

        header = ttk.Frame(outer)
        header.pack(fill="x")
        ttk.Label(header, text="KINO — LIVE ΑΠΟΤΕΛΕΣΜΑΤΑ", font=("Segoe UI", 22, "bold")).pack(side="left")
        ttk.Checkbutton(
            header, text="Πάντα μπροστά", variable=self.topmost_var, command=self._toggle_topmost
        ).pack(side="right")

        ttk.Label(outer, textvariable=self.draw_var, font=("Segoe UI", 16, "bold")).pack(pady=(18, 4))
        ttk.Label(outer, textvariable=self.result_var, font=("Segoe UI", 36, "bold")).pack(pady=(0, 4))
        ttk.Label(outer, textvariable=self.count_var, font=("Segoe UI", 15)).pack(pady=(0, 14))

        nums = ttk.LabelFrame(outer, text="20 αριθμοί τελευταίας κλήρωσης", padding=12)
        nums.pack(fill="x", pady=(0, 14))
        for i, var in enumerate(self.number_vars):
            ttk.Label(nums, textvariable=var, width=4, anchor="center", font=("Segoe UI", 16, "bold")).grid(
                row=i // 10, column=i % 10, padx=5, pady=5, sticky="nsew"
            )
            nums.columnconfigure(i % 10, weight=1)

        streak = ttk.LabelFrame(outer, text="Τρέχον streak", padding=10)
        streak.pack(fill="x", pady=(0, 14))
        ttk.Label(streak, textvariable=self.streak_var, font=("Segoe UI", 15, "bold")).pack()

        recent = ttk.LabelFrame(outer, text="12 πιο πρόσφατα αποτελέσματα", padding=10)
        recent.pack(fill="both", expand=True)
        for i, var in enumerate(self.recent_vars):
            ttk.Label(recent, textvariable=var, font=("Segoe UI", 11)).grid(
                row=i // 2, column=i % 2, sticky="w", padx=8, pady=3
            )
        recent.columnconfigure(0, weight=1)
        recent.columnconfigure(1, weight=1)

        ttk.Separator(outer).pack(fill="x", pady=(12, 8))
        ttk.Label(outer, textvariable=self.status_var).pack(anchor="w")

    def _heartbeat(self):
        if self.winfo_exists():
            self.status_var.set(self.parent.status_var.get())
            self.after(1000, self._heartbeat)

    def refresh(self):
        rows = self.parent.store.recent(12)
        if rows:
            r = rows[0]
            dt = datetime.fromisoformat(r["draw_time_local"])
            self.draw_var.set(f"Κλήρωση #{r['draw_id']} — {dt.strftime('%d/%m/%Y %H:%M:%S')}")
            self.result_var.set(r["result"])
            self.count_var.set(f"Μονά {r['odd_count']}   |   Ζυγά {r['even_count']}")
            numbers = r["numbers"].split(",")
            for i, var in enumerate(self.number_vars):
                var.set(numbers[i] if i < len(numbers) else "—")
        else:
            self.draw_var.set("Αναμονή για την πρώτη κλήρωση…")
            self.result_var.set("—")
            self.count_var.set("Μονά —  |  Ζυγά —")
            for var in self.number_vars:
                var.set("—")

        no_odd, no_even, ties = self.parent.store.streaks()
        self.streak_var.set(f"Χωρίς ΜΟΝΑ: {no_odd}   |   Χωρίς ΖΥΓΑ: {no_even}   |   Ισοπαλίες: {ties}")

        for i, var in enumerate(self.recent_vars):
            if i < len(rows):
                r = rows[i]
                dt = datetime.fromisoformat(r["draw_time_local"])
                var.set(f"{dt.strftime('%H:%M')}  #{r['draw_id']}  →  {r['result']}  ({r['odd_count']}-{r['even_count']})")
            else:
                var.set("")


class LiveApp(core.App):
    def __init__(self):
        self.live_window = None
        super().__init__()
        self._add_menu()
        self.open_live_window()

    def _add_menu(self):
        menu = tk.Menu(self)
        view = tk.Menu(menu, tearoff=False)
        view.add_command(label="Live αποτελέσματα", command=self.open_live_window)
        view.add_command(label="Ρυθμίσεις email", command=self.open_email_settings)
        view.add_command(label="Τι είναι το App Password;", command=self.show_app_password_help)
        menu.add_cascade(label="KINO Monitor", menu=view)
        self.config(menu=menu)

    def show_app_password_help(self):
        messagebox.showinfo(
            "Google App Password",
            "Το App Password είναι ξεχωριστός κωδικός 16 χαρακτήρων που δημιουργεί η Google για το KINO Monitor.\n\n"
            "Πήγαινε: Ρυθμίσεις email → Άνοιγμα Google App Passwords.\n"
            "Χρειάζεται πρώτα να έχεις ενεργοποιήσει Επαλήθευση σε 2 βήματα.\n\n"
            "Δεν χρησιμοποιούμε τον κανονικό κωδικό Gmail.",
            parent=self,
        )

    def open_live_window(self):
        if self.live_window is None or not self.live_window.winfo_exists():
            self.live_window = LiveResultsWindow(self)
        else:
            self.live_window.show()

    def refresh_table(self):
        super().refresh_table()
        live = getattr(self, "live_window", None)
        if live is not None and live.winfo_exists():
            live.refresh()


if __name__ == "__main__":
    LiveApp().mainloop()
