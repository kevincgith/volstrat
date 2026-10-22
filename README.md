# VolStrat: volatility-regime allocator

A research dashboard that turns public volatility and risk-sentiment data into a composite
**risk-appetite score** (0 = crisis, 100 = strong risk-on). The score then drives a tactical asset
allocation, which is backtested against standard benchmarks. Scoring and backtesting run in the
browser, so the results update as soon as you change a parameter.

> **Disclaimer.** This is a personal research project. All results are hypothetical and backtested.
> They don't reflect actual trading and they benefit from hindsight in the model design. This is
> not investment advice.

## Status

| Phase | Scope | State |
|---|---|---|
| P0 | Repo, scaffold, CI, Pages deploy | ✅ |
| P1 | Data pipeline: Cboe indices, VX futures curve, put/call, assets, macro; daily Action | ⏳ |
| P2 | TypeScript scoring and backtest engine with look-ahead tests | ⏳ |
| P3 | Dashboard, Signals, Backtest pages; URL-encoded parameters | ⏳ |
| P4 | Robustness (IS/OOS, walk-forward, sensitivity), Compare, exports | ⏳ |
| P5 | Methodology content and polish | ⏳ |

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

# website
cd web
npm install
npm run dev      # http://localhost:5173/volstrat/
npm test
```

## Deployment

- `ci.yml` runs lint, tests, typecheck and build on every PR and every push to `main`.
- `deploy.yml` builds the site, bundles `data/site` and publishes it to GitHub Pages. It runs on
  pushes that touch `web/` or `data/site/`, and after each successful data update.
- **Custom domain:** add the domain under *Settings → Pages* and set the repository variable
  `VITE_BASE` to `/`.

## Adding a data source or indicator

This section is filled in during Phase 1, once the source interface exists. In short:
1. Add a fetcher in `pipeline/volstrat_pipeline/sources/` that returns a date-indexed DataFrame.
2. Register its schema and range checks.
3. Add the feature to the site export.
4. Register the component, with its direction and description, in the web engine's component list.

## Data sources

The sources are Cboe (index history, CFE VIX futures, put/call ratios), Yahoo Finance (ETFs and
indices), US Treasury (yield curve) and FRED (credit spreads and stress indices, fetched without an
API key). Coverage, quirks and fallbacks are documented in
[docs/METHODOLOGY.md](docs/METHODOLOGY.md#data-sources). The data is included for personal,
non-commercial research and remains subject to each provider's terms.

## License

MIT for the code (see [LICENSE](LICENSE)).
