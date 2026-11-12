# Volstrat Architecture Overview

Last reviewed: 2026-11-12. Written for IT and other reviewers; for the model itself see [METHODOLOGY.md](METHODOLOGY.md).

## Purpose

VolStrat is a personal research dashboard. It takes public market data (volatility indices, VIX futures, put/call ratios, credit spreads, yields and asset prices) and combines it into a **risk-appetite score** from 0 (crisis) to 100 (strong risk-on). The score drives a model asset allocation, which the site backtests against standard benchmarks.

- **Live site:** https://app.kevinlhc.com/volstrat/
- **What it is not:** it places no trades, connects to no brokerage, and holds no client or firm data. All results are hypothetical. It is not investment advice.
- **Users:** anyone with the link can view it. There are no logins or user accounts.

The design has one central idea. The site is **static files only**, with no application server and no database. A scheduled job collects the data once per update and publishes it as JSON files. All the parameter-dependent maths (scoring, backtests, optimisation) runs **inside the viewer's browser**.

## At a glance

```
 Public data sources                      Cloudflare Worker
 (Cboe, CFE, Yahoo Finance,               (cron trigger, every hour at :20;
  US Treasury, FRED, BLS)                  starts the workflow via the GitHub API)
        |  downloads                              |  starts run
        v                                         v
 +---------------- GitHub Actions: data update workflow ----------------+
 |  Python pipeline                    ->   Signal snapshot (TypeScript)  |
 |  fetch, validate, guard, build           official score and regime;    |
 |  writes data/raw and data/site           appends to live track records |
 +----------------------------------------------------------------------+
        |  commits                                |  alerts
        v                                         v
 Git repository (public)                  GitHub issues and RSS feed
 data/raw, data/site, data/track          (source failures, incomplete
 committed only when data changed          days, regime changes)
        |  triggers deploy
        v
 Deploy workflow                    ->    GitHub Pages
 builds the React site,                   static files on a custom domain;
 bundles the data/site JSON files         no server code, no database
                                                  |  served to
                                                  v
                                          Viewer's browser
                                          loads the JSON; runs scoring and
                                          backtests in a Web Worker.
                                          No login, no tracking
```

Data moves in one direction. A scheduled job on GitHub downloads public data, checks it and commits it to the repository. The repository is rebuilt into a static website, and each viewer's browser does the calculations locally.

## Components

| Component | Technology | Where it runs | What it does |
| --- | --- | --- | --- |
| Scheduler | Cloudflare Worker (JavaScript), file `worker/volstrat-refresh.js` | Cloudflare, cron trigger every hour at :20 | Calls the GitHub API to start the data-update workflow. It does nothing else. |
| Data pipeline | Python 3.12 package `volstrat_pipeline` (pandas, pyarrow, requests, yfinance) | GitHub Actions runner, workflow `data-update.yml` | Downloads public data, validates it, builds features and writes JSON for the site. |
| Signal snapshot | TypeScript script `web/scripts/signal.ts`, run with Node 24 | Same GitHub Actions job | Uses the same engine as the website to compute today's score and regime. It appends the day's decision to the live track records and writes the RSS feed. |
| Data store | Plain CSV and JSON files committed to the Git repository (`data/`) | GitHub repository | `data/raw` is the cached downloads (about 21 MB). `data/site` is the JSON the website reads (about 6 MB). `data/track` is the append-only live track records. |
| Website | Vite, React 19, TypeScript, ECharts | Built by `deploy.yml`, served by GitHub Pages | A static single-page app. It loads the JSON files and runs scoring and backtests in a browser Web Worker. |

Two names are easy to confuse. **`worker/`** is the Cloudflare scheduler. **`web/src/workers/`** is the in-browser Web Worker that runs calculations off the page's main thread.

## Daily data cycle and publishing rules

Each hourly run does the following:

1. **Trigger.** The Cloudflare Worker starts the `Data update` workflow through the GitHub API. GitHub's own schedule (twice per weekday) stays on as a backup, because GitHub runs scheduled jobs late or skips them.
2. **Fetch.** `volstrat update` downloads each source with timeouts and bounded retries. Every fetched series passes range checks before anything is saved.
3. **Guard.** The storage layer refuses any write that would replace good data with empty, shorter or older data. It also flags any silent change to history that should not change.
4. **Build.** Raw series are aligned to a trading calendar and exported to `data/site/*.json`. Cross-source sanity checks flag stale or implausible values, and the Dashboard shows them.
5. **Snapshot.** The TypeScript engine computes the official score and appends that day's decision to the live track records.
6. **Commit.** The workflow commits only if real data changed. Files that every run rewrites, such as timestamps and status files, do not count as a change. Any real change, however small (for example a revised price), is committed and published.
7. **Deploy.** A commit dispatches `deploy.yml`, which rebuilds the site and publishes it to GitHub Pages.
8. **Alert.** The workflow opens or updates GitHub issues when a required source fails, when a day's data is still incomplete at noon New York time the next business day, or when the model's regime changes. The regime change also goes to an RSS feed.

**Completeness gate.** Vendors publish at different times after the close. A date becomes *official*, and enters the live track records, only once **every** input has been published for it. Until then the site stays on the last complete date and lists what it is waiting for. Viewers can switch on a *provisional* view of the newest date, but the track records and alerts never use it.

**Track records** in `data/track/` are append-only. Parameters are frozen on each version's first run. Existing rows are never rewritten or backfilled.

## Hosting, external services and dependencies

**Hosting**

- **GitHub:** a public repository holds the source code and data, Actions runs the pipeline, CI and deploys, and Pages hosts the site. The site is served on a custom domain.
- **Cloudflare Workers:** used only for the hourly trigger.
- No servers, VMs, databases or paid cloud infrastructure.

**Outbound data sources** (read-only, public endpoints, fetched by the pipeline on the GitHub runner)

| Source | Used for |
| --- | --- |
| Cboe / CFE | Volatility index history, VIX futures, put/call ratios |
| Yahoo Finance (via `yfinance`) | ETF and index prices |
| US Treasury | Yield curve |
| FRED (St. Louis Fed) | Credit spreads, stress indices. An optional API key is used if one is configured. |
| BLS (via FRED or the BLS public API) | Unemployment rate |

The HTTP client sends a browser-style User-Agent, because some of these public endpoints reject default script clients.

**What a viewer's browser loads**

- The site's own HTML, JavaScript and JSON data files, all from the same origin.
- Google Fonts (Inter, JetBrains Mono).
- Nothing else. The site has no analytics, no tracking, no cookies and no third-party scripts. `localStorage` keeps only the viewer's own preferences: theme, the provisional-view toggle and saved comparison profiles.

**Software dependencies**

- Python: pandas, pyarrow, requests, yfinance. For development only: pytest, ruff.
- JavaScript: react, react-dom, react-router-dom, echarts, lz-string. For build only: vite, vitest, typescript. Versions are pinned in `web/package-lock.json`.

## Security and access

- **No sensitive data.** The system processes only public market data. It stores no personal, client or firm information, and it has no user accounts or logins.
- **Secrets.** No secret is stored in the repository. There are two credentials:
  - `GITHUB_TOKEN` is a Cloudflare Worker secret. It is a fine-grained GitHub token scoped to this one repository, with *Actions: read and write* only. Its sole use is to start the data workflow.
  - `FRED_API_KEY` (optional) is a GitHub Actions repository secret, used for the FRED data API.
- **Workflow permissions** are declared per workflow and kept to what each job needs. The data job can write repository contents and issues. The deploy job can only read contents and write Pages. CI uses the default read-only access.
- **Private notes** with setup details stay on the owner's machine. Git is configured to ignore them, so they are never uploaded.
- **Who can change things:** only the repository owner can push to `main` or change the Cloudflare Worker. Automated commits come from the GitHub Actions bot and touch only `data/`.
- **Attack surface:** the public site is read-only static hosting, with no forms, no APIs and no server-side code. The Cloudflare Worker runs only on its cron schedule. The code has no request handler.

## Testing, CI and how changes ship

- **CI (`ci.yml`)** runs on every pull request and every push to `main`, in three jobs:
  - Python: ruff lint, format check, pytest.
  - Web: TypeScript typecheck, vitest (including look-ahead tests, which check the backtest never uses data from the future), production build.
  - Cron worker: Node unit tests for the Cloudflare trigger.
- **Deploy (`deploy.yml`)** runs on pushes that touch `web/` or `data/site/`, and after each data update that committed new data.
- **Code changes** are made by the owner, often with an AI coding assistant (Claude Code), and committed to `main`. Every deploy is a rebuild from the repository, so the site can always be traced to a commit. Note: `main` has no branch protection, so CI reports failures but does not block a push or a deploy.
- **Research changes** to the model are pre-registered in `docs/PREREG-v*.md` before they are tested, and the full methodology is in `docs/METHODOLOGY.md`.

## Repository map

| Path | Contents |
| --- | --- |
| `pipeline/volstrat_pipeline/` | Python pipeline: `sources/` (one fetcher per vendor), `build/` (alignment, features, export), `checks/` (cross-source checks), `storage.py` (write guards), `cli.py` |
| `web/src/engine/` | TypeScript scoring, allocation, backtest, statistics and optimisation engine |
| `web/src/pages/`, `components/`, `charts/` | Dashboard, Signals, Backtest, Diagnostics, Optimise, Compare and Methodology pages |
| `web/src/workers/` | In-browser Web Worker that runs the engine |
| `web/scripts/` | Node scripts run by the data workflow (daily signal snapshot) |
| `worker/` | Cloudflare Worker that triggers the hourly data run |
| `data/raw/`, `data/site/`, `data/track/` | Cached downloads, published JSON, live track records |
| `tests/` | pytest suite and Cloudflare Worker tests (web tests sit beside the engine code) |
| `docs/` | Methodology, pre-registration documents and a slide overview |
| `.github/workflows/` | `ci.yml`, `data-update.yml`, `deploy.yml` |

The source code is MIT-licensed. Data stays subject to each provider's terms and is used for personal, non-commercial research.
