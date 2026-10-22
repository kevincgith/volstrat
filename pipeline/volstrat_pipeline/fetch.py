"""Run every source fetcher and record their status."""

from __future__ import annotations

import json
import logging
import traceback
from pathlib import Path

import pandas as pd

from .sources import cboe_indices, cboe_putcall, cfe_vx, fred, treasury, yahoo
from .sources.base import SourceStatus
from .sources.fetch_status import STATUS_FILE

log = logging.getLogger(__name__)


def _guarded(name: str, required: bool, fn) -> list[SourceStatus]:
    try:
        res = fn()
        return res if isinstance(res, list) else [res]
    except Exception as e:  # report every failure, decide on exit code later
        log.error("%s failed: %s", name, e)
        log.debug(traceback.format_exc())
        return [SourceStatus(name, required=required, ok=False, message=str(e)[:300])]


def run(raw_dir: Path, only: list[str] | None = None) -> list[SourceStatus]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    steps = {
        "cboe_indices": (True, lambda: cboe_indices.update(raw_dir)),
        "cfe_vx": (True, lambda: cfe_vx.update(raw_dir)),
        "cboe_putcall": (False, lambda: cboe_putcall.update(raw_dir)),
        "treasury": (True, lambda: treasury.update(raw_dir)),
        "yahoo": (True, lambda: yahoo.update(raw_dir)),
        "fred": (False, lambda: fred.update(raw_dir)),
    }
    statuses: list[SourceStatus] = []
    for name, (required, fn) in steps.items():
        if only and name not in only:
            continue
        log.info("fetching %s", name)
        statuses.extend(_guarded(name, required, fn))

    # merge with previous status so a partial run keeps the other sources' entries
    path = raw_dir / STATUS_FILE
    prev = json.loads(path.read_text()) if path.exists() else {}
    prev.update({s.name: {**s.to_dict(), "checked_at": pd.Timestamp.now(tz="UTC").isoformat()}
                 for s in statuses})  # fmt: skip
    path.write_text(json.dumps(prev, indent=1, sort_keys=True) + "\n")
    return statuses
