import json
import os
from fastapi import APIRouter, Query, HTTPException
from ..services.cache import cache
from ..services.yfinance_service import get_sector_stats, get_quote

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _load_by_sector(market: str) -> dict[str, list[dict]]:
    fname = "bist_tickers.json" if market == "BIST" else "us_tickers.json"
    path = os.path.join(DATA_DIR, fname)
    with open(path, "r", encoding="utf-8") as f:
        tickers = json.load(f)

    sector_map: dict[str, list[dict]] = {}
    for t in tickers:
        s = t.get("sector", "Diğer")
        sector_map.setdefault(s, []).append(t)
    return sector_map


@router.get("/sectors")
def get_sectors(market: str = Query("BIST", pattern="^(BIST|US)$")):
    key = f"sectors:{market}"
    cached = cache.get(key)
    if cached:
        return cached

    sector_map = _load_by_sector(market)
    result = [
        {
            "sector": sector,
            "count": len(items),
            "tickers": [i["ticker"] for i in items],
        }
        for sector, items in sorted(sector_map.items())
    ]
    cache.set(key, result, ttl=3600)
    return result


@router.get("/sectors/{sector_name}/stocks")
def get_sector_stocks(
    sector_name: str,
    market: str = Query("BIST", pattern="^(BIST|US)$"),
):
    key = f"sector_stocks:{market}:{sector_name}"
    cached = cache.get(key)
    if cached:
        return cached

    sector_map = _load_by_sector(market)
    items = sector_map.get(sector_name)
    if items is None:
        raise HTTPException(status_code=404, detail=f"Sector not found: {sector_name}")

    stocks = []
    for item in items:
        q = get_quote(item["ticker"]) or {}
        stocks.append({
            "ticker": item["ticker"],
            "name": item["name"],
            "sector": item["sector"],
            "currentPrice": q.get("currentPrice"),
            "changePercent": q.get("changePercent"),
            "change": q.get("change"),
            "currency": q.get("currency"),
            "marketCap": q.get("marketCap"),
            "pe": q.get("pe"),
            "pb": None,  # fetched per-ticker in ratios endpoint
        })

    result = {"sector": sector_name, "stocks": stocks}
    cache.set(key, result, ttl=120)
    return result


@router.get("/sectors/{sector_name}/stats")
def get_sector_statistics(
    sector_name: str,
    market: str = Query("BIST", pattern="^(BIST|US)$"),
):
    sector_map = _load_by_sector(market)
    items = sector_map.get(sector_name)
    if items is None:
        raise HTTPException(status_code=404, detail=f"Sector not found: {sector_name}")

    tickers = [i["ticker"] for i in items]
    stats = get_sector_stats(tickers)
    return {"sector": sector_name, **stats}
