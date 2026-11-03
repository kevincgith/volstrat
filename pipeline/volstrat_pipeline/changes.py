"""Decide whether a data update is worth a commit (and so a site redeploy).

The hourly update re-downloads the last few days of every source, and Yahoo keeps
revising the latest bar for hours after the close (GC=F by up to ~1%, MSCI World,
MOVE and VOLI in the last decimals). Before this check almost every run committed
and redeployed a site that differed only in those digits.

Skipping such a run loses nothing: every run regenerates the revisions, and they
land with the next real change, normally the next trading day's rows.
"""

from __future__ import annotations

import csv
import io
import re
import subprocess

# Files every run rewrites (timestamps, status): never news on their own.
BOOKKEEPING = re.compile(
    r"^data/(raw/_fetch_status\.json|raw/_fetch_meta\.json|site/meta\.json"
    r"|site/latest\.json|site/feed\.xml|site/track_record\.json)$"
)
# Rebuilt from data/raw: they follow the raw files' verdict.
DERIVED = re.compile(r"^data/site/")

REL_TOL = 0.01  # a value revised by more than 1% is news
MAX_REVISED_ROWS = 20  # more than this is a history rewrite, not a late revision


def _close(a: str, b: str) -> bool:
    try:
        x, y = float(a), float(b)
    except ValueError:
        return False
    return abs(x - y) <= REL_TOL * max(abs(x), abs(y))


def compare_csv(old: str, new: str) -> str | None:
    """None when `new` only revises existing values of `old` slightly, else why it is news."""
    o = list(csv.reader(io.StringIO(old)))
    n = list(csv.reader(io.StringIO(new)))
    if not o or not n or o[0] != n[0]:
        return "header changed"
    if len(o) != len(n):
        return f"{len(n) - len(o):+d} rows"
    revised = 0
    for a, b in zip(o[1:], n[1:], strict=True):
        if a == b:
            continue
        revised += 1
        if len(a) != len(b) or a[0] != b[0]:
            return f"row {a[0] if a else '?'} replaced"
        for col, x, y in zip(o[0], a, b, strict=False):
            if x != y and not _close(x, y):
                return f"{a[0]} {col}: {x or 'blank'} -> {y or 'blank'}"
    if revised > MAX_REVISED_ROWS:
        return f"{revised} rows revised"
    return None


def classify(
    changes: dict[str, tuple[str | None, str | None]], signal_changed: bool = False
) -> tuple[bool, list[str]]:
    """Whether staged `changes` ({path: (old text, new text)}) deserve a commit, and why."""
    real: list[str] = []
    revised: list[str] = []
    derived: list[str] = []
    for path, (old, new) in sorted(changes.items()):
        if BOOKKEEPING.match(path):
            continue
        if DERIVED.match(path):
            derived.append(path)
            continue
        if old is None:
            reason = "new file"
        elif new is None:
            reason = "deleted"
        elif path.endswith(".csv"):
            reason = compare_csv(old, new)
        else:
            reason = "changed"
        if reason:
            real.append(f"{path}: {reason}")
        else:
            revised.append(path)
    if signal_changed:
        real.append("regime changed")
    if derived and not real and not revised:
        # Site files changed with no raw change behind them: new build code, so news.
        real += [f"{p}: rebuilt" for p in derived]
    lines = [f"news     {r}" for r in real]
    lines += [f"revised  {p} (within {REL_TOL:.0%})" for p in revised]
    return bool(real), lines


def _git_show(spec: str) -> str | None:
    r = subprocess.run(["git", "show", spec], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def staged_changes(prefix: str = "data") -> dict[str, tuple[str | None, str | None]]:
    """{path: (HEAD text, staged text)} for every staged change under `prefix`."""
    paths = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--", prefix],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split()
    return {p: (_git_show(f"HEAD:{p}"), _git_show(f":{p}")) for p in paths}
