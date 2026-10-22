"""Common types for source fetchers."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass
class SourceStatus:
    """Outcome of one source update, reported in data/site/meta.json."""

    name: str
    required: bool
    ok: bool = False
    last_date: str | None = None
    rows: int = 0
    message: str = ""
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def drop_bad(series, lo: float, hi: float, name: str, max_frac: float = 0.002):
    """Null out values outside [lo, hi]; raise if more than `max_frac` are bad.

    Returns (cleaned_series, number_of_values_removed).
    """
    s = series.astype(float)
    bad = s.notna() & ((s < lo) | (s > hi))
    n = int(bad.sum())
    if n and n / max(s.notna().sum(), 1) > max_frac:
        raise ValueError(f"{name}: {n} values outside [{lo}, {hi}] - schema change?")
    return s.mask(bad), n
