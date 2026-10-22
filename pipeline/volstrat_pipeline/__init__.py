"""VolStrat data pipeline: fetch -> validate -> build features -> export site JSON."""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw"
SITE_DIR = REPO_ROOT / "data" / "site"

__version__ = "0.1.0"
