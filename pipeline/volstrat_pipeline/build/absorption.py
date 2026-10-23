"""Absorption ratio (Kritzman, Li, Page and Rigobon, 2010).

The share of the total variance of a set of asset returns explained by its top
principal components. A high share means the assets move together, driven by
a few common factors, so shocks spread widely. Here: the 9 original Select
Sector SPDRs, top 2 components (about a fifth, as in the paper).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

SECTORS = ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]


def absorption_ratio(
    prices: pd.DataFrame, n_pc: int = 2, window: int = 252, halflife: float = 126
) -> pd.Series:
    """AR at each date from the exponentially weighted covariance of the last
    `window` daily log returns (ending that date). NaN unless every column has a
    return on every day of the window. Uses data up to each date only."""
    r = np.log(prices).diff().iloc[1:]
    x = r.to_numpy()
    ok = np.isfinite(x).all(axis=1)
    w = 0.5 ** (np.arange(window)[::-1] / halflife)  # oldest .. newest
    w /= w.sum()
    out = np.full(len(r), np.nan)
    run = 0
    for t in range(len(r)):
        run = run + 1 if ok[t] else 0
        if run < window:
            continue
        xs = x[t - window + 1 : t + 1]
        dm = xs - w @ xs
        cov = (dm * w[:, None]).T @ dm
        ev = np.linalg.eigvalsh(cov)  # ascending
        tot = ev.sum()
        if tot > 0:
            out[t] = ev[-n_pc:].sum() / tot
    return pd.Series(out, index=r.index)
