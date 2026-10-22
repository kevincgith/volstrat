"""VIX futures curve features from settlement prices.

Definitions (all on settlement prices, calendar days to expiry):
  * live contracts on date t: monthly contracts with expiry strictly after t
    (on its expiry date a contract settles to the special opening quotation
    and is no longer part of the curve);
  * VX1 / VX2: the first and second live contracts;
  * constant maturity CM(T): linear interpolation in days-to-expiry between the
    two contracts bracketing T days. Spot VIX is used as the 0-day anchor when
    T is shorter than VX1's maturity. No extrapolation beyond the last contract.
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


def features(vx: pd.DataFrame, spot: pd.Series) -> pd.DataFrame:
    """Daily VX1, VX2, VX1 days-to-expiry and CM30/60/90."""
    curve = live_curve(vx)
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
