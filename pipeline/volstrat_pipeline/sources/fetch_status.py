"""Read the per-source status written by `volstrat fetch`."""

from __future__ import annotations

import json
from pathlib import Path

STATUS_FILE = "_fetch_status.json"


def load_status(raw_dir: Path) -> dict:
    path = raw_dir / STATUS_FILE
    return json.loads(path.read_text()) if path.exists() else {}
