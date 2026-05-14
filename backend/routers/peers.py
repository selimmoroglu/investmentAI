"""Sektör emsal karşılaştırma — bir hissenin sektöründeki diğer top hisseler."""
import json
import os
from fastapi import APIRouter, HTTPException, Query
from ..services.cache import cache
from ..services.yfinance_service import get_quote, get_ratios

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _load_all_tickers() -> list[dict]:
    out: list[dict] = []
    for fname, market in [("bist_tickers.json", "BIST"), ("us_tickers.json", "US")]:
        with open(os.path.join(DATA_DIR, fname), "r", encoding="utf-8") as f:
            for item in json.load(f):
                out.append({**item, "market": market})
    return out


@router.get("/peers/{ticker:path}")
def get_peers(ticker: str, limit: int = Query(5, ge=1, le=15)):
    """Hisseyi sektör emsalleriyle karşılaştır. Ana hisse hariç top N."""
    cache_key = f"peers:{ticker}:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    all_tickers = _load_all_tickers()
    own = next((t for t in all_tickers if t["ticker"].upper() == ticker.upper()), None)
    if not own:
        raise HTTPException(status_code=404, detail=f"Ticker not found in master list: {ticker}")

    sector = own["sector"]
    market = own["market"]
    sector_peers = [t for t in all_tickers if t["sector"] == sector and t["market"] == market and t["ticker"].upper() != ticker.upper()]

    # Önce kendisini ekle (highlight için), sonra peer'ları
    rows = []
    for t in [own] + sector_peers:
        q = get_quote(t["ticker"]) or {}
        r = get_ratios(t["ticker"]) or {}
        fcf = q.get("freeCashflow")
        mcap = q.get("marketCap")
        fcf_yield = (fcf / mcap * 100) if (fcf and mcap and mcap > 0) else None
        rows.append({
            "ticker": t["ticker"],
            "name": t.get("name") or q.get("name") or t["ticker"],
            "isOwn": t["ticker"].upper() == ticker.upper(),
            "currentPrice": q.get("currentPrice"),
            "changePercent": q.get("changePercent"),
            "currency": q.get("currency"),
            "marketCap": mcap,
            "pe": r.get("pe"),
            "pb": r.get("pb"),
            "roe": r.get("roe"),
            "netMargin": r.get("netMargin"),
            "debtToEquity": r.get("debtToEquity"),
            "dividendYield": r.get("dividendYield"),
            "fcfYield": round(fcf_yield, 2) if fcf_yield is not None else None,
        })

    # Sort: ana hisse her zaman en üstte, sonra market cap'a göre büyük→küçük
    rows.sort(key=lambda r: (0 if r["isOwn"] else 1, -(r["marketCap"] or 0)))

    # Limit (kendisi + top N peer = N+1 satır)
    rows = rows[: limit + 1]

    result = {
        "ticker": ticker,
        "sector": sector,
        "market": market,
        "peers": rows,
    }
    cache.set(cache_key, result, ttl=3600)
    return result
