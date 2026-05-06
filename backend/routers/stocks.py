import json
import os
from fastapi import APIRouter, Query
import yfinance as yf
from ..services.cache import cache

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _load_tickers(market: str) -> list[dict]:
    fname = "bist_tickers.json" if market == "BIST" else "us_tickers.json"
    path = os.path.join(DATA_DIR, fname)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _fetch_prices_bulk(tickers: list[str]) -> dict:
    """Fetch latest prices for multiple tickers at once using yf.download."""
    key = f"bulk_prices:{'|'.join(sorted(tickers))}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        df = yf.download(
            tickers,
            period="2d",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        prices = {}
        for ticker in tickers:
            try:
                if len(tickers) == 1:
                    close_series = df["Close"]
                else:
                    close_series = df["Close"][ticker]
                close_series = close_series.dropna()
                if len(close_series) >= 2:
                    current = float(close_series.iloc[-1])
                    prev = float(close_series.iloc[-2])
                    change = round(current - prev, 4)
                    change_pct = round((change / prev) * 100, 2)
                elif len(close_series) == 1:
                    current = float(close_series.iloc[-1])
                    prev = current
                    change = 0.0
                    change_pct = 0.0
                else:
                    current = prev = change = change_pct = None
                prices[ticker] = {
                    "currentPrice": current,
                    "previousClose": prev,
                    "change": change,
                    "changePercent": change_pct,
                }
            except Exception:
                prices[ticker] = {
                    "currentPrice": None,
                    "previousClose": None,
                    "change": None,
                    "changePercent": None,
                }
        cache.set(key, prices, ttl=120)
        return prices
    except Exception:
        return {}


@router.get("/stocks")
def get_stocks(market: str = Query("BIST", pattern="^(BIST|US)$")):
    tickers_data = _load_tickers(market)
    tickers = [t["ticker"] for t in tickers_data]
    prices = _fetch_prices_bulk(tickers)

    result = []
    for item in tickers_data:
        p = prices.get(item["ticker"], {})
        result.append({
            "ticker": item["ticker"],
            "name": item["name"],
            "sector": item["sector"],
            "currentPrice": p.get("currentPrice"),
            "previousClose": p.get("previousClose"),
            "change": p.get("change"),
            "changePercent": p.get("changePercent"),
        })
    return result
