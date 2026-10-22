"""Cross-source sanity checks run on every build.

Each source is validated on its own when fetched; these checks compare sources
against each other and flag stale or implausible latest values, so that a
silent problem in one feed (e.g. Yahoo returning a blank close) is visible on
the Dashboard. Results are warnings, recorded in data/site/meta.json.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd


@dataclass
class Check:
    name: str
    ok: bool
    detail: str

    def to_dict(self) -> dict:
        return asdict(self)


def _rel_gap(a: pd.Series, b: pd.Series, last: int = 60) -> tuple[float, int]:
    j = pd.concat([a, b], axis=1, join="inner").dropna().tail(last)
    if j.empty:
        return float("nan"), 0
    rel = (j.iloc[:, 0] / j.iloc[:, 1] - 1).abs()
    return float(rel.median()), len(j)


def vol_index_agreement(cboe: pd.DataFrame, yahoo: dict[str, pd.Series]) -> list[Check]:
    out = []
    for sym, ysym in (("VIX3M", "^VIX3M"), ("VVIX", "^VVIX")):
        if sym not in cboe or ysym not in yahoo:
            continue
        gap, n = _rel_gap(cboe[sym], yahoo[ysym])
        ok = n >= 20 and gap < 0.01
        out.append(
            Check(
                f"{sym}: Cboe vs Yahoo", ok, f"median abs gap {gap:.2%} over last {n} common days"
            )
        )
    return out


def spy_vs_index(spy: pd.Series, sp500tr: pd.Series) -> Check:
    j = pd.concat([spy.pct_change(), sp500tr.pct_change()], axis=1, join="inner").dropna().tail(60)
    if len(j) < 20:
        return Check("SPY vs S&P 500 TR returns", False, f"only {len(j)} common days")
    corr = float(j.corr().iloc[0, 1])
    mad = float((j.iloc[:, 0] - j.iloc[:, 1]).abs().median())
    ok = corr > 0.99 and mad < 0.001
    return Check(
        "SPY vs S&P 500 TR returns", ok, f"60d corr {corr:.4f}, median abs diff {mad * 1e4:.1f} bp"
    )


def futures_vs_spot(signals: pd.DataFrame) -> Check:
    s = signals[["VX1", "VIX"]].dropna()
    if s.empty:
        return Check("VX1 / spot VIX", False, "no data")
    r = float(s["VX1"].iloc[-1] / s["VIX"].iloc[-1])
    ok = 0.6 <= r <= 1.8
    return Check("VX1 / spot VIX", ok, f"{r:.2f} on {s.index[-1].date()} (plausible 0.6-1.8)")


def calendar_vs_cboe(calendar_last: pd.Timestamp, cboe_last: pd.Timestamp) -> Check:
    lag = int(np.busday_count(calendar_last.date(), cboe_last.date()))
    ok = lag <= 0
    detail = f"calendar ends {calendar_last.date()}, Cboe VIX {cboe_last.date()}" + (
        ""
        if ok
        else f" - Yahoo S&P 500 is {lag} business day(s) behind; the latest day is excluded"
    )
    return Check("Trading calendar up to date", ok, detail)


def staleness(signals: pd.DataFrame, keys: list[str], max_bdays: int = 3) -> list[Check]:
    last_day = signals.index[-1]
    out = []
    for k in keys:
        if k not in signals:
            continue
        v = signals[k].dropna()
        if v.empty:
            continue
        lag = int(np.busday_count(v.index[-1].date(), last_day.date()))
        out.append(
            Check(
                f"{k} fresh", lag <= max_bdays, f"last value {v.index[-1].date()} ({lag} bd behind)"
            )
        )
    return out


def jumps(assets: dict[str, pd.Series], limit: float = 0.25) -> list[Check]:
    out = []
    for k, tr in assets.items():
        r = tr.pct_change().dropna().tail(5)
        if r.empty:
            continue
        lim = limit * (3 if k == "UPRO" else 2 if k == "SSO" else 1)
        worst = float(r.abs().max())
        if worst > lim:
            out.append(
                Check(
                    f"{k} latest returns",
                    False,
                    f"|daily return| {worst:.1%} in last 5 days exceeds {lim:.0%}",
                )
            )
    if not out:
        out.append(Check("Asset returns (last 5 days)", True, "no implausible daily moves"))
    return out
