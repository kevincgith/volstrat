# VolStrat: volatility-regime allocator

A research dashboard that turns public volatility and risk-sentiment data into a composite
**risk-appetite score** (0 = crisis, 100 = strong risk-on). The score then drives a tactical asset
allocation, which is backtested against standard benchmarks. Scoring and backtesting run in the
browser, so the results update as soon as you change a parameter.

**Live site:** https://app.kevinlhc.com/volstrat/ (data refreshed every US trading day by a
GitHub Action).

> **Disclaimer.** This is a personal research project. All results are hypothetical and backtested.
> They don't reflect actual trading and they benefit from hindsight in the model design. This is
> not investment advice.

## Status

| Phase | Scope | State |
|---|---|---|
| P0 | Repo, scaffold, CI, Pages deploy | ✅ |
| P1 | Data pipeline: Cboe indices, VX futures curve, put/call, assets, macro; daily Action | ✅ |
| P2 | TypeScript scoring and backtest engine with look-ahead tests | ✅ |
| P3 | Dashboard, Signals, Backtest pages; URL-encoded parameters | ✅ |
| P4 | Robustness (IS/OOS, walk-forward, sensitivity), Compare, exports | ✅ |
| P5 | Methodology content and polish | ✅ |

## Features

- **Dashboard:** today's score, regime, recommended allocation, component breakdown,
  stock–bond correlation, recent regime changes, data status.
- **Signals:** 24 components, including nine VTS-style dashboard metrics (off by default, see
  METHODOLOGY §14); every component's history over the S&P 500 with regime shading; animated VIX
  futures term structure.
- **Backtest:**
  - every parameter is editable and recomputes instantly in a Web Worker; settings live in
    the URL;
  - statistics against six benchmarks, plus bootstrap confidence intervals and an equal-risk check (the strategy scaled to each benchmark's volatility);
  - equity, drawdown, allocation, rolling and monthly charts;
  - sensitivity heatmap, walk-forward test and multiple-testing check;
  - CSV/PNG export.
- **Diagnostics:** asset behaviour after each regime or score bucket, information
  coefficient, and leave-one-out component attribution.
- **Optimise:**
  - regime portfolios (mean-variance with shrinkage), tested walk-forward;
  - signal weights (coordinate descent), with train/test split and walk-forward
    re-optimisation;
  - "apply" buttons to load the results on the Backtest page.
- **Whipsaw and cost controls:** asymmetric regime buffers, minimum holding period,
  per-asset trading costs, cost drag and break-even cost.
- **Compare:** saved parameter profiles side by side.
- **Methodology:** plain-English documentation with stress-episode tables computed from the
  data.
- **Alerts:** an RSS feed (`/data/feed.xml`) and a GitHub issue when the default profile's
  regime changes. Watch the repository to get these by email.

## Architecture

```
GitHub Action (daily, after the US close)
  pipeline/  Python: fetch -> validate -> build features -> data/site/*.json -> commit
GitHub Pages
  web/       Vite + React + TypeScript + ECharts. Scoring and backtest run in a Web Worker.
```

GitHub Pages only serves static files. So the pipeline ships **raw features** (VIX levels, futures
curve, spreads, asset total returns), and the browser does all the parameter-dependent work:
standardisation windows, weights, thresholds, smoothing and the backtest itself.

## Repository layout

```
pipeline/volstrat_pipeline/   Python package (sources/, build/, checks/, storage.py, cli.py)
data/raw/                     cached raw downloads (parquet)
data/site/                    compact JSON consumed by the website
tests/pipeline/               pytest suite
web/                          frontend (src/engine holds the scoring + backtest engine)
docs/METHODOLOGY.md           methodology and data-source notes
.github/workflows/            ci.yml, deploy.yml, data-update.yml (from P1)
```

## Running locally

Requirements: Python 3.11+ and Node 22+.

```bash
# pipeline
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/pytest
.venv/bin/volstrat update      # fetch new data + rebuild data/site/*.json

# website
cd web
npm install
npm run dev      # http://localhost:5173/volstrat/
npm test
```

**Troubleshooting (macOS):** if `volstrat` or `pytest` raises `ModuleNotFoundError:
volstrat_pipeline`, macOS has set the "hidden" flag on the editable-install `.pth` file, and
Python 3.13 skips hidden `.pth` files. Inside iCloud-synced folders such as Documents the flag
keeps coming back, so set the path explicitly: `export PYTHONPATH=$PWD/pipeline`. `pytest`
already does this through `pyproject.toml`.

## Deployment

- **Data schedule:** a Cloudflare Worker (`worker/volstrat-refresh.js`, set up in the
  Cloudflare dashboard) dispatches the data-update workflow every hour at :20. A run commits
  and redeploys the site only when data actually changed. GitHub's own schedule is best effort
  and often late, so it's kept only as a fallback.
- **Completeness gate:** a date is only published once every input of the strategy has been
  published for it. Vendors post at different times after the close. Until then the site stays
  on the last complete date, and the Dashboard lists what it is waiting for.
- `ci.yml` runs lint, tests, typecheck and build on every PR and every push to `main`.
- `deploy.yml` builds the site, bundles `data/site` and publishes it to GitHub Pages. It runs on
  pushes that touch `web/` or `data/site/`, and after each successful data update.
- **Custom domain:** add the domain under *Settings → Pages* and set the repository variable
  `VITE_BASE` to `/`.

## Adding a data source or indicator

1. **Fetcher:** add a module in `pipeline/volstrat_pipeline/sources/` with an
   `update(raw_dir) -> SourceStatus` function (or a list of them) that downloads the data,
   cleans it with `drop_bad` range checks, and saves it with `storage.safe_write`. Then add it
   to the `steps` dict in `pipeline/volstrat_pipeline/fetch.py`. For a new Yahoo ticker, just
   add a `Ticker(...)` to `sources/yahoo.py`.
2. **Signal input:** add an entry to `SIGNAL_META` in `build/export.py`, with label, unit,
   source and **availability lag**, and load the series in `build_signals`. It then appears in
   `data/site/signals.json`.
3. **Tradeable asset:** add an `AssetSpec` to `ASSETS` in `build/export.py` with its source
   chain (ETF first, then proxies flagged `synthetic=True`).
4. **Score component:** register the component, with its direction, transform and
   description, in the web engine's component registry (`web/src/engine/components.ts`, from
   Phase 2).
5. **Tests:** add pytest cases for parsing and any construction logic, then run
   `volstrat fetch --only <source>` followed by `volstrat build`.

## Data sources

The sources are Cboe (index history, CFE VIX futures, put/call ratios), Yahoo Finance (ETFs and
indices), US Treasury (yield curve) and FRED (credit spreads and stress indices, fetched without an
API key). Coverage, quirks and fallbacks are documented in
[docs/METHODOLOGY.md](docs/METHODOLOGY.md#data-sources). The data is included for personal,
non-commercial research and remains subject to each provider's terms.

## License

MIT for the code (see [LICENSE](LICENSE)).
