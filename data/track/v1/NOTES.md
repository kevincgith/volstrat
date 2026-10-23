# Live track record v1 — notes

Append-only annotations. Decision rows in `decisions.csv` are never edited; anything worth
knowing about a row is recorded here instead.

- **2026-10-22 decision** (logged 2026-10-23 01:11 UTC). It was computed before the
  completeness gate existed. That evening Yahoo had published only index bars for 22 Oct (no
  ETF bars), Cboe's VIX and SKEW fields for 22 Oct were still blank, and the CFE settlement
  files and Cboe put/call ratios had not been updated. The engine therefore carried the
  21 Oct values of those inputs forward. The decision (Neutral, SPX 60% / IEF 40%) equals the
  previous day's, so the target was unaffected. From the next run onwards, a date is only
  logged once every input of the strategy has been published for it
  (`build/export.py: completeness`).
- **2026-10-22, follow-up** (2026-10-23). Once all inputs for 22 Oct were published, recomputing
  the day with complete data gives score **37.7** (logged: 42.82). The regime and target are
  unchanged: Neutral, SPX 60% / IEF 40%. 37.7 sits just above the 37.5 level at which
  hysteresis would have moved the regime to Risk-Off.
- **2026-10-23: defaults changed.** The site's default profile became *Growth*, with its own
  record in `data/track/v2/`. v1 keeps the Balanced parameters frozen in `params.json` and
  continues unchanged. Fields added to the parameters later (such as the rebound override)
  are filled with their "off" value, never the new defaults; a test checks this.
