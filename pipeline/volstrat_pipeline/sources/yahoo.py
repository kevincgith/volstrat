"""Yahoo Finance daily history via yfinance (unofficial API).

Stores close and dividend-adjusted close per ticker. Adjusted prices are
rescaled by Yahoo whenever a dividend is paid, so history stability is checked
on daily returns rather than levels.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from ..storage import (
    DataGuardError,
    check_history_stable,
    read_cache,
    safe_write,
    stabilise_adjusted,
)
from .base import SourceStatus

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Ticker:
    symbol: str
    role: str
    required: bool = True


TICKERS: list[Ticker] = [
    # equity / risk assets
    Ticker("^GSPC", "S&P 500 price index (master calendar, trend, realised vol)"),
    Ticker("^SP500TR", "S&P 500 total-return index (SPY pre-1993 extension)"),
    Ticker("SPY", "S&P 500 ETF"),
    Ticker("SSO", "2x S&P 500 ETF"),
    Ticker("UPRO", "3x S&P 500 ETF"),
    Ticker("URTH", "MSCI World ETF"),
    Ticker("^990100-USD-STRD", "MSCI World price index (URTH pre-2012 extension)", False),
    # defensive assets and their extensions
    Ticker("IEF", "7-10y Treasury ETF"),
    Ticker("TLT", "20y+ Treasury ETF"),
    Ticker("AGG", "US aggregate bond ETF"),
    Ticker("SHY", "1-3y Treasury ETF"),
    Ticker("BIL", "1-3m T-bill ETF"),
    Ticker("GLD", "Gold ETF"),
    Ticker("XLU", "Utilities sector ETF"),
    Ticker("VFITX", "Vanguard Intermediate Treasury fund (IEF extension)", False),
    Ticker("VUSTX", "Vanguard Long Treasury fund (TLT extension)", False),
    Ticker("VBMFX", "Vanguard Total Bond fund (AGG extension)", False),
    Ticker("VFISX", "Vanguard Short Treasury fund (SHY extension)", False),
    Ticker("FSUTX", "Fidelity Select Utilities fund (XLU extension)", False),
    Ticker("GC=F", "Gold front-month future (GLD extension)", False),
    # credit proxies
    Ticker("HYG", "High-yield corporate bond ETF (credit proxy)", False),
    Ticker("LQD", "Investment-grade corporate bond ETF (credit proxy)", False),
    Ticker("VWEHX", "Vanguard High-Yield Corporate fund (credit proxy extension)", False),
    # volatility fallbacks
    Ticker("^VIX3M", "VIX3M (pre-2009 history missing from the Cboe file)", False),
    Ticker("^VVIX", "VVIX fallback", False),
    Ticker("^MOVE", "ICE BofA MOVE index (Treasury implied vol)", False),
    Ticker("^IRX", "13-week T-bill discount rate (cash fallback)", False),
]


def cache_name(symbol: str) -> str:
    safe = symbol.replace("^", "IDX_").replace("=", "_").replace("-", "_")
    return f"yahoo/{safe}.csv"


def fetch(symbol: str, retries: int = 3) -> pd.DataFrame:
    import yfinance as yf  # imported lazily: heavy and only needed for fetching

    last = ""
    for attempt in range(1, retries + 1):
        try:
            h = yf.Ticker(symbol).history(period="max", auto_adjust=False, actions=False)
            if not h.empty:
                df = pd.DataFrame(
                    {"close": h["Close"], "adj_close": h.get("Adj Close", h["Close"])}
                )
                df.index = pd.DatetimeIndex(h.index.tz_localize(None).normalize())
                df = df[df["close"] > 0].dropna(subset=["close"])
                return df[~df.index.duplicated(keep="last")].sort_index()
            last = "empty response"
        except Exception as e:  # yfinance raises a variety of exception types
            last = f"{type(e).__name__}: {e}"
        time.sleep(2 * attempt)
    raise RuntimeError(f"{symbol}: {last}")


def drop_incomplete_today(df: pd.DataFrame, now: pd.Timestamp | None = None) -> pd.DataFrame:
    """Remove a bar for today if the US session may not be closed yet (before 16:30 ET)."""
    now = now or pd.Timestamp.now(tz="America/New_York")
    today = now.tz_localize(None).normalize()
    if len(df) and df.index[-1] == today and now.hour * 60 + now.minute < 16 * 60 + 30:
        return df.iloc[:-1]
    return df


def update(raw_dir: Path) -> list[SourceStatus]:
    out = []
    for t in TICKERS:
        st = SourceStatus(f"yahoo:{t.symbol}", required=t.required)
        try:
            df = drop_incomplete_today(fetch(t.symbol))
            path = raw_dir / cache_name(t.symbol)
            cached = read_cache(path)
            # Adjusted history is rescaled on dividends: compare returns, loosely...
            check_history_stable(cached, df, ["adj_close"], returns=True, max_changed_frac=0.02)
            # ...then keep the stored history and append only new days (no daily churn).
            df = stabilise_adjusted(cached, df)
            safe_write(df, path)
            st.ok, st.rows, st.last_date = True, len(df), df.index[-1].date().isoformat()
        except (DataGuardError, RuntimeError) as e:
            st.message = str(e)
            log.warning("yahoo %s failed: %s", t.symbol, e)
            cached = read_cache(raw_dir / cache_name(t.symbol))
            if cached is not None:
                st.rows, st.last_date = len(cached), cached.index[-1].date().isoformat()
        out.append(st)
        time.sleep(0.5)
    return out


def load(raw_dir: Path, symbol: str) -> pd.DataFrame | None:
    return read_cache(raw_dir / cache_name(symbol))
