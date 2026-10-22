"""Shared HTTP session: browser-like UA, timeouts and bounded retries with backoff."""

from __future__ import annotations

import logging
import time

import requests

log = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
_session = requests.Session()
_session.headers.update({"User-Agent": USER_AGENT, "Accept": "*/*"})


class FetchError(RuntimeError):
    """A source could not be fetched after all retries."""


def get(
    url: str,
    *,
    timeout: float = 45,
    retries: int = 3,
    backoff: float = 2.0,
    missing_ok: tuple[int, ...] = (),
) -> requests.Response | None:
    """GET `url`, retrying transient failures.

    Returns None when the status code is in `missing_ok` (e.g. 403/404 for a
    file that legitimately does not exist, such as a holiday). Raises FetchError
    once retries are exhausted.
    """
    last: str = ""
    for attempt in range(1, retries + 1):
        try:
            r = _session.get(url, timeout=timeout)
        except requests.RequestException as e:
            last = f"{type(e).__name__}: {e}"
        else:
            if r.status_code == 200:
                return r
            if r.status_code in missing_ok:
                return None
            last = f"HTTP {r.status_code}"
        if attempt < retries:
            time.sleep(backoff * attempt)
    raise FetchError(f"{url}: {last}")
