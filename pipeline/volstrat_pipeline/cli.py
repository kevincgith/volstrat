"""Command-line entry point: `volstrat <command>`."""

from __future__ import annotations

import argparse
import logging
import sys

from . import RAW_DIR, SITE_DIR


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="volstrat", description="VolStrat data pipeline")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)
    f = sub.add_parser("fetch", help="download new raw data into data/raw")
    f.add_argument("--only", nargs="*", help="subset of sources, e.g. cfe_vx yahoo")
    sub.add_parser("build", help="build features and export data/site JSON")
    sub.add_parser("update", help="fetch + build (what the daily Action runs)")
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    for noisy in ("yfinance", "urllib3", "peewee"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    failed_required: list[str] = []
    if args.command in ("fetch", "update"):
        from .fetch import run

        for s in run(RAW_DIR, getattr(args, "only", None)):
            flag = "OK " if s.ok else ("FAIL" if s.required else "warn")
            print(f"[{flag}] {s.name:28s} last={s.last_date} rows={s.rows} {s.message}")
            for w in s.warnings:
                print(f"       ! {w}")
            for r in s.revisions[:10]:
                print(f"       ~ revised {r['date']} {r['column']}: {r['old']} -> {r['new']}")
            if s.required and not s.ok:
                failed_required.append(s.name)
    if args.command in ("build", "update"):
        from .build.export import build_all

        build_all(RAW_DIR, SITE_DIR)
    if failed_required:
        print(f"required sources failed: {', '.join(failed_required)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
