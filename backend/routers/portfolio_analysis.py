"""Portföy uzun vade analizi — ağırlıklı composite skor + sektör dağılımı + konsantrasyon riski."""
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional
from fastapi import APIRouter, Query
from ..services.valuation import composite_long_term_score
from ..services.cache import cache

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

_SECTOR_CACHE: Optional[dict] = None


def _load_sector_lookup() -> dict:
    global _SECTOR_CACHE
    if _SECTOR_CACHE is not None:
        return _SECTOR_CACHE
    m = {}
    for fname in ["bist_tickers.json", "us_tickers.json"]:
        try:
            with open(os.path.join(DATA_DIR, fname), encoding="utf-8") as f:
                for item in json.load(f):
                    m[item["ticker"].upper()] = item.get("sector") or "Diğer"
        except Exception:
            pass
    _SECTOR_CACHE = m
    return m


def _fetch_ticker_data(ticker: str) -> dict:
    """Tek ticker için composite skor + sektör bilgisi (1s cache)."""
    cache_key = f"portanalysis5:{ticker}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    # Sektörü önce yerel JSON'dan al, yoksa yfinance'ten çek
    sector_map = _load_sector_lookup()
    sector = sector_map.get(ticker.upper())
    if not sector:
        try:
            import yfinance as yf
            info = yf.Ticker(ticker).info or {}
            sector = info.get("sector") or "Diğer"
        except Exception:
            sector = "Diğer"

    try:
        comp = composite_long_term_score(ticker)
        result = {
            "ticker": ticker,
            "sector": sector,
            "compositeScore": comp.get("score"),
            "compositeVerdict": comp.get("verdict", "Tut"),
            "verdictColor": comp.get("verdictColor", "warn"),
            "breakdown": comp.get("breakdown") or {"quality": 50, "value": 50, "growth": 50, "yield": 50},
            "isFinancial": comp.get("isFinancial", False),
        }
    except Exception:
        result = {
            "ticker": ticker,
            "sector": sector,
            "compositeScore": None,
            "compositeVerdict": "Veri Yok",
            "verdictColor": "neutral",
            "breakdown": None,
            "isFinancial": False,
        }

    cache.set(cache_key, result, ttl=3600)
    return result


@router.get("/portfolio/analysis")
def get_portfolio_analysis(
    tickers: str = Query(..., description="Virgülle ayrılmış ticker listesi, max 30"),
    weights: str = Query(..., description="Virgülle ayrılmış ondalık ağırlıklar (toplam herhangi sayı, normalize edilir)"),
):
    """
    Portföy için ağırlıklı uzun vade skoru + sektör dağılımı + konsantrasyon riski.

    Döner:
    - portfolioScore (0-100), portfolioVerdict, portfolioBreakdown
    - concentrationHHI (0-1), diversificationScore (0-100)
    - sectorBreakdown {sektörAdı: ağırlık}
    - positions [{ticker, sector, compositeScore, breakdown, weight, ...}]
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:30]
    if not ticker_list:
        return {"error": "En az 1 ticker gerekli"}

    # Ağırlıkları normalize et
    try:
        raw_w = [float(w) for w in weights.split(",")][:len(ticker_list)]
        total_w = sum(raw_w)
        weight_list = [w / total_w if total_w > 0 else 1.0 / len(ticker_list) for w in raw_w]
    except Exception:
        weight_list = [1.0 / len(ticker_list)] * len(ticker_list)

    # Eksik ağırlıkları eşit dağıt
    while len(weight_list) < len(ticker_list):
        weight_list.append(0.0)

    # Paralel veri çekimi (max 5 eş zamanlı)
    raw_results = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_map = {executor.submit(_fetch_ticker_data, t): t for t in ticker_list}
        for future in as_completed(future_map):
            ticker = future_map[future]
            try:
                data = future.result(timeout=35)
                raw_results[data["ticker"]] = data
            except Exception:
                raw_results[ticker] = {
                    "ticker": ticker, "sector": "Diğer",
                    "compositeScore": None, "compositeVerdict": "Veri Yok",
                    "verdictColor": "neutral", "breakdown": None, "isFinancial": False,
                }

    # Aggregate ve positions listesi oluştur
    positions_out = []
    sectors: dict = {}
    agg_composite = 0.0
    agg_quality = 0.0
    agg_value = 0.0
    agg_growth = 0.0
    agg_yield = 0.0

    for i, ticker in enumerate(ticker_list):
        w = weight_list[i]
        data = raw_results.get(ticker, {
            "ticker": ticker, "sector": "Diğer",
            "compositeScore": None, "compositeVerdict": "Veri Yok",
            "verdictColor": "neutral", "breakdown": None, "isFinancial": False,
        })

        cs = data.get("compositeScore") or 50
        bd = data.get("breakdown") or {}
        agg_composite += w * cs
        agg_quality += w * (bd.get("quality") or 50)
        agg_value += w * (bd.get("value") or 50)
        agg_growth += w * (bd.get("growth") or 50)
        agg_yield += w * (bd.get("yield") or 50)

        sec = data.get("sector") or "Diğer"
        sectors[sec] = sectors.get(sec, 0.0) + w

        positions_out.append({**data, "weight": round(w, 4)})

    # Portföy verdict
    ps = round(agg_composite)
    if ps >= 75:
        verdict, vcolor = "Çok Cazip", "up"
    elif ps >= 60:
        verdict, vcolor = "Cazip", "up"
    elif ps >= 45:
        verdict, vcolor = "Tut", "warn"
    elif ps >= 30:
        verdict, vcolor = "Pahalı", "warn"
    else:
        verdict, vcolor = "Kaçın", "down"

    # Konsantrasyon (HHI = Herfindahl–Hirschman Index)
    n = len(ticker_list)
    hhi = round(sum(w ** 2 for w in weight_list), 4)
    min_hhi = 1.0 / n if n > 1 else 1.0
    safe_range = max(1.0 - min_hhi, 0.001)
    div_score = round(max(0, min(100, (1 - (hhi - min_hhi) / safe_range) * 100))) if n > 1 else 0

    # Konsantrasyon seviyesi
    if hhi < 0.15:
        conc_label, conc_color = "Düşük", "up"
    elif hhi < 0.25:
        conc_label, conc_color = "Orta", "warn"
    else:
        conc_label, conc_color = "Yüksek", "down"

    return {
        "portfolioScore": ps,
        "portfolioVerdict": verdict,
        "portfolioVerdictColor": vcolor,
        "portfolioBreakdown": {
            "quality": round(agg_quality),
            "value": round(agg_value),
            "growth": round(agg_growth),
            "yield": round(agg_yield),
        },
        "concentrationHHI": hhi,
        "concentrationLabel": conc_label,
        "concentrationColor": conc_color,
        "diversificationScore": div_score,
        "topPositionWeight": round(max(weight_list) if weight_list else 0, 4),
        "sectorBreakdown": dict(sorted(sectors.items(), key=lambda x: -x[1])),
        "sectorCount": len(sectors),
        "positions": positions_out,
        "tickerCount": n,
    }
