"""TR TÜFE (CPI) yardımcıları — reel getiri hesaplama."""
import json
import os
from typing import Optional
from .cache import cache

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "tr_cpi.json")


def load_tr_cpi() -> list[dict]:
    """tr_cpi.json'u oku, 1 gün cache'le. List of {date, index}."""
    key = "tr_cpi:series"
    cached = cache.get(key)
    if cached:
        return cached
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    cache.set(key, data, ttl=86400)
    return data


def _cpi_map() -> dict[str, float]:
    """date_string ('2024-06') → index lookup map."""
    series = load_tr_cpi()
    return {row["date"]: row["index"] for row in series}


def cpi_at(year_month: str) -> Optional[float]:
    """Verilen ay için CPI değeri. year_month: 'YYYY-MM'."""
    return _cpi_map().get(year_month)


def cpi_at_or_nearest(year_month: str) -> Optional[float]:
    """Tam ay yoksa en yakın (geriye doğru) ay'ı döndür."""
    m = _cpi_map()
    if year_month in m:
        return m[year_month]
    # geri tarihler içinde en yakını bul
    series = load_tr_cpi()
    valid = [r for r in series if r["date"] <= year_month]
    if not valid:
        # ileri dönük en yakını dene
        valid_future = [r for r in series if r["date"] >= year_month]
        if valid_future:
            return valid_future[0]["index"]
        return None
    return valid[-1]["index"]


def inflation_between(start: str, end: str) -> Optional[float]:
    """İki ay arası kümülatif TÜFE % (örn 250 → %250). start ve end: 'YYYY-MM'."""
    s = cpi_at_or_nearest(start)
    e = cpi_at_or_nearest(end)
    if s is None or e is None or s <= 0:
        return None
    return ((e - s) / s) * 100


def real_return(nominal_pct: float, start: str, end: str) -> Optional[float]:
    """Nominal getiriden (%) reel getiri (%) — Fisher formülü:
    real = ((1+nom) / (1+inf)) - 1"""
    inf = inflation_between(start, end)
    if inf is None:
        return None
    nom_dec = nominal_pct / 100.0
    inf_dec = inf / 100.0
    if (1 + inf_dec) == 0:
        return None
    return (((1 + nom_dec) / (1 + inf_dec)) - 1) * 100
