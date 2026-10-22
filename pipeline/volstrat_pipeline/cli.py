"""Command-line entry point: `volstrat <command>`."""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="volstrat", description="VolStrat data pipeline")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("fetch", help="download new raw data into data/raw (Phase 1)")
    sub.add_parser("build", help="build features and export data/site JSON (Phase 1)")
    sub.add_parser("update", help="fetch + build (what the daily Action runs)")
    args = parser.parse_args(argv)
    print(f"volstrat {args.command}: not implemented yet (Phase 1)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
