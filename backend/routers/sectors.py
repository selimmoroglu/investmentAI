import json
import os
from fastapi import APIRouter, Query
from ..services.cache import cache

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


@router.get("/sectors")
def get_sectors(market: str = Query("BIST", pattern="^(BIST|US)$")):
    key = f"sectors:{market}"
    cached = cache.get(key)
    if cached:
        return cached

    fname = "bist_tickers.json" if market == "BIST" else "us_tickers.json"
    path = os.path.join(DATA_DIR, fname)
    with open(path, "r", encoding="utf-8") as f:
        tickers = json.load(f)

    sector_map: dict[str, list[str]] = {}
    for t in tickers:
        s = t.get("sector", "Diğer")
        sector_map.setdefault(s, []).append(t["ticker"])

    result = [
        {"sector": sector, "count": len(ticker_list), "tickers": ticker_list}
        for sector, ticker_list in sorted(sector_map.items())
    ]
    cache.set(key, result, ttl=3600)
    return result
