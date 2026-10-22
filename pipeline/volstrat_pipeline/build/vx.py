"""VIX futures curve features from settlement prices.

Definitions (all on settlement prices, calendar days to expiry):
  * live contracts on date t: monthly contracts with expiry strictly after t
    (on its expiry date a contract settles to the special opening quotation
    and is no longer part of the curve);
  * VX1 / VX2: the first and second live contracts;
  * constant maturity CM(T): linear interpolation in days-to-expiry between the
    two contracts bracketing T days. Spot VIX is used as the 0-day anchor when
    T is shorter than VX1's maturity. No extrapolation beyond the last contract.
  * VX30 (VTS definition): a 1-month constant-maturity blend that rolls from M1
    into M2 linearly over the expiry cycle in TRADING days:
        w = trading days left to M1 expiry / trading days in the cycle
        VX30 = w * M1 + (1 - w) * M2
    At the start of a cycle VX30 = M1; just before expiry it is almost all M2.
    The same weights applied to (M2, M3) give VTS's "adjusted M2".
  * VX1..VX7: the n-th live monthly contract.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

CM_TENORS = (30, 60, 90)


def live_curve(vx: pd.DataFrame) -> pd.DataFrame:
    """Long frame of live contracts with `dte` (calendar days to expiry), sorted."""
    df = vx[vx["expiry"] > vx["date"]].copy()
    df["dte"] = (df["expiry"] - df["date"]).dt.days
    return df.sort_values(["date", "expiry"]).reset_index(drop=True)


def interpolate(dtes: np.ndarray, prices: np.ndarray, target: float) -> float:
    """Linear interpolation on (dte, price) points sorted by dte; NaN if out of range."""
    if len(dtes) == 0 or target < dtes[0] or target > dtes[-1]:
        return float("nan")
    return float(np.interp(target, dtes, prices))


def roll_weight(date, prev_expiry, m1_expiry, holidays) -> float:
    """Share of M1 in VX30: trading days left / trading days in the cycle."""
    left = np.busday_count(date.date(), m1_expiry.date(), holidays=holidays)
    cycle = np.busday_count(prev_expiry.date(), m1_expiry.date(), holidays=holidays)
    return float(min(1.0, max(0.0, left / cycle))) if cycle > 0 else float("nan")


def features(vx: pd.DataFrame, spot: pd.Series, holidays: list | None = None) -> pd.DataFrame:
    """Daily VX1..VX7, VX1 days-to-expiry, CM30/60/90, VX30 and adjusted M2 (VTS)."""
    curve = live_curve(vx)
    expiries = np.sort(vx["expiry"].unique())
    hol = [pd.Timestamp(h).date() for h in (holidays or [])]
    rows = []
    for date, g in curve.groupby("date", sort=True):
        dtes = g["dte"].to_numpy(dtype=float)
        px = g["settle"].to_numpy(dtype=float)
        row = {
            "date": date,
            "VX1": px[0],
            "VX2": px[1] if len(px) > 1 else np.nan,
            "VX1_DTE": dtes[0],
        }
        for k in range(3, 8):
            row[f"VX{k}"] = px[k - 1] if len(px) >= k else np.nan
        # VTS VX30 / adjusted M2: roll over the cycle in trading days
        past = expiries[expiries <= np.datetime64(date)]
        w = np.nan
        if len(past) and len(px) > 1:
            w = roll_weight(date, pd.Timestamp(past[-1]), g["expiry"].iloc[0], hol)
        row["VX30"] = w * px[0] + (1 - w) * px[1] if len(px) > 1 else np.nan
        row["VX_ADJ_M2"] = w * px[1] + (1 - w) * px[2] if len(px) > 2 else np.nan
        v = spot.get(date, np.nan)
        if np.isfinite(v):
            d_all, p_all = np.r_[0.0, dtes], np.r_[v, px]
        else:
            d_all, p_all = dtes, px
        for t in CM_TENORS:
            row[f"VX_CM{t}"] = interpolate(d_all, p_all, t)
        rows.append(row)
    return pd.DataFrame(rows).set_index("date")


def curve_snapshots(vx: pd.DataFrame, calendar: pd.DatetimeIndex, max_contracts: int = 9):
    """Per trading date: list of [dte, settle] for up to `max_contracts` live contracts."""
    curve = live_curve(vx)
    curve = curve[curve["date"].isin(calendar)]
    out = {}
    for date, g in curve.groupby("date", sort=True):
        g = g.head(max_contracts)
        pairs = zip(g["dte"], g["settle"], strict=True)
        out[date] = [[int(d), round(float(p), 3)] for d, p in pairs]
    return out
