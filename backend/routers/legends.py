"""Yatırım üstatları (Buffett, Graham, Lynch, ...) — strateji filtreleri ve uyumlu hisse listesi."""
import json
import os
from fastapi import APIRouter, HTTPException, Query
from typing import Callable, Optional
from ..services.cache import cache
from ..services.yfinance_service import get_quote, get_ratios

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _load_tickers(market: str) -> list[dict]:
    fname = "bist_tickers.json" if market == "BIST" else "us_tickers.json"
    with open(os.path.join(DATA_DIR, fname), "r", encoding="utf-8") as f:
        return json.load(f)


# Yardımcı: değer var mı?
def _has(r: dict, key: str) -> bool:
    return r.get(key) is not None


# Permissive (data-tolerant) filtreler:
# - Veri varsa threshold'a uymalı; yoksa kuralı geç (penalize değil)
# - Her stratejide en az minimum sayıda gerçek kanıt aranır

def _buffett_filter(r: dict) -> bool:
    """Kaliteli işletme + makul fiyat. yfinance eksik veri verse de elimizdekiyle değerlendiriyoruz."""
    # Hard fails — verisi varsa kötü olmamalı
    if _has(r, "pe") and (r["pe"] < 0 or r["pe"] > 35): return False
    if _has(r, "roe") and r["roe"] < 0.08: return False
    if _has(r, "netMargin") and r["netMargin"] < 0.04: return False
    if _has(r, "debtToEquity") and r["debtToEquity"] > 200: return False

    # Pozitif kanıt sayısı
    evidence = 0
    if _has(r, "roe") and r["roe"] >= 0.10: evidence += 1
    if _has(r, "netMargin") and r["netMargin"] >= 0.06: evidence += 1
    if _has(r, "pe") and 0 < r["pe"] <= 30: evidence += 1
    if _has(r, "grossMargin") and r["grossMargin"] >= 0.20: evidence += 1
    if _has(r, "revenueGrowth") and r["revenueGrowth"] > 0: evidence += 1
    return evidence >= 2


def _buffett_score(r: dict) -> float:
    score = 0.0
    score += min((r.get("roe") or 0) / 0.30, 1.0) * 30
    score += min((r.get("netMargin") or 0) / 0.25, 1.0) * 25
    if r.get("pe") and r["pe"] > 0:
        score -= min(r["pe"] / 30, 1.0) * 15
    if r.get("debtToEquity") is not None:
        score -= min(r["debtToEquity"] / 100, 1.0) * 10
    score += min(max(r.get("revenueGrowth") or 0, 0) / 0.20, 1.0) * 10
    score += min((r.get("grossMargin") or 0) / 0.50, 1.0) * 10
    return round(max(score, 0), 1)


def _graham_filter(r: dict) -> bool:
    """Derin değer — defter değerine yakın fiyat, sağlam bilanço."""
    # Hard fails
    if _has(r, "pe") and (r["pe"] <= 0 or r["pe"] > 20): return False
    if _has(r, "pb") and (r["pb"] <= 0 or r["pb"] > 2.5): return False
    if _has(r, "debtToEquity") and r["debtToEquity"] > 120: return False
    if _has(r, "roe") and r["roe"] < 0: return False
    if _has(r, "currentRatio") and r["currentRatio"] < 1.0: return False

    # Verisi olmayan PE/PB iddialı kabul edilemez — en az birinin olması gerek
    has_value_ratio = (_has(r, "pe") and 0 < r["pe"] <= 18) or (_has(r, "pb") and r["pb"] <= 2.0)
    if not has_value_ratio: return False
    return True


def _graham_score(r: dict) -> float:
    score = 50.0
    if r.get("pe") and r["pe"] > 0:
        score -= min(r["pe"] / 15, 1.0) * 25
    if r.get("pb") and r["pb"] > 0:
        score -= min(r["pb"] / 1.8, 1.0) * 20
    if r.get("currentRatio"):
        score += min(r["currentRatio"] / 3.0, 1.0) * 15
    if r.get("debtToEquity") is not None:
        score -= min(r["debtToEquity"] / 80, 1.0) * 10
    if r.get("dividendYield"):
        score += min(r["dividendYield"] / 0.05, 1.0) * 10
    return round(max(score, 0), 1)


def _lynch_filter(r: dict) -> bool:
    """GARP — makul fiyatla büyüme."""
    if _has(r, "pe") and (r["pe"] <= 0 or r["pe"] > 40): return False
    if _has(r, "peg") and (r["peg"] < 0 or r["peg"] > 2.5): return False
    if _has(r, "debtToEquity") and r["debtToEquity"] > 150: return False

    # En az birinden büyüme kanıtı gerekli (PEG, revenueGrowth veya earningsGrowth)
    has_growth_evidence = (
        (_has(r, "peg") and 0 < r["peg"] <= 2.0) or
        (_has(r, "revenueGrowth") and r["revenueGrowth"] >= 0.05) or
        (_has(r, "earningsGrowth") and r["earningsGrowth"] >= 0.10)
    )
    if not has_growth_evidence: return False
    return True


def _lynch_score(r: dict) -> float:
    score = 0.0
    score += min(max(r.get("revenueGrowth") or 0, 0) / 0.30, 1.0) * 30
    score += min(max(r.get("earningsGrowth") or 0, 0) / 0.30, 1.0) * 25
    if r.get("peg") and r["peg"] > 0:
        score -= min(r["peg"] / 1.5, 1.0) * 15
    if r.get("pe") and r["pe"] > 0:
        score -= min(r["pe"] / 30, 1.0) * 10
    score += min((r.get("roe") or 0) / 0.20, 1.0) * 10
    return round(max(score, 0), 1)


def _greenblatt_filter(r: dict) -> bool:
    """Magic Formula — yüksek kalite + ucuz fiyat."""
    # PE ve ROE birlikte gerekli (formülün özü)
    if not _has(r, "pe") or r["pe"] <= 0 or r["pe"] > 25: return False
    if not _has(r, "roe") or r["roe"] < 0.10: return False
    earnings_yield = 1 / r["pe"]
    if earnings_yield < 0.05: return False  # P/E < 20
    return True


def _greenblatt_score(r: dict) -> float:
    if not r.get("pe") or r["pe"] <= 0: return 0
    earnings_yield = 1 / r["pe"]
    return round((earnings_yield * 100) + ((r.get("roe") or 0) * 100), 1)


def _munger_filter(r: dict) -> bool:
    """Munger — harika işletme + makul fiyat. Kalite önde."""
    if _has(r, "pe") and (r["pe"] <= 0 or r["pe"] > 40): return False
    if _has(r, "debtToEquity") and r["debtToEquity"] > 100: return False

    # Kalite kanıtı şart: ROE veya yüksek brüt marj
    quality_evidence = 0
    if _has(r, "roe") and r["roe"] >= 0.15: quality_evidence += 1
    if _has(r, "grossMargin") and r["grossMargin"] >= 0.30: quality_evidence += 1
    if _has(r, "netMargin") and r["netMargin"] >= 0.10: quality_evidence += 1
    return quality_evidence >= 1


def _munger_score(r: dict) -> float:
    score = 0.0
    score += min((r.get("roe") or 0) / 0.35, 1.0) * 30
    score += min((r.get("grossMargin") or 0) / 0.60, 1.0) * 25
    score += min((r.get("netMargin") or 0) / 0.25, 1.0) * 20
    if r.get("pe") and r["pe"] > 0:
        score -= min(r["pe"] / 35, 1.0) * 15
    return round(max(score, 0), 1)


def _fisher_filter(r: dict) -> bool:
    """Fisher — yüksek kaliteli büyüme."""
    if _has(r, "debtToEquity") and r["debtToEquity"] > 120: return False
    # Büyüme + kalite kanıtı şart
    has_growth = _has(r, "revenueGrowth") and r["revenueGrowth"] >= 0.08
    has_quality = (_has(r, "roe") and r["roe"] >= 0.10) or (_has(r, "netMargin") and r["netMargin"] >= 0.05)
    return has_growth and has_quality


def _fisher_score(r: dict) -> float:
    score = 0.0
    score += min(max(r.get("revenueGrowth") or 0, 0) / 0.30, 1.0) * 30
    score += min(max(r.get("earningsGrowth") or 0, 0) / 0.30, 1.0) * 25
    score += min((r.get("roe") or 0) / 0.25, 1.0) * 20
    score += min((r.get("grossMargin") or 0) / 0.50, 1.0) * 15
    return round(max(score, 0), 1)


def _druckenmiller_filter(r: dict) -> bool:
    """Druckenmiller — momentum + büyüme."""
    # En az iki büyüme/kalite kanıtı (esnek)
    evidence = 0
    if _has(r, "earningsGrowth") and r["earningsGrowth"] >= 0.10: evidence += 1
    if _has(r, "revenueGrowth") and r["revenueGrowth"] >= 0.08: evidence += 1
    if _has(r, "roe") and r["roe"] >= 0.10: evidence += 1
    return evidence >= 2


def _druckenmiller_score(r: dict) -> float:
    score = 0.0
    score += min(max(r.get("earningsGrowth") or 0, 0) / 0.40, 1.0) * 35
    score += min(max(r.get("revenueGrowth") or 0, 0) / 0.30, 1.0) * 25
    score += min((r.get("roe") or 0) / 0.25, 1.0) * 20
    return round(max(score, 0), 1)


STRATEGIES: dict[str, dict[str, Callable]] = {
    "buffett": {"filter": _buffett_filter, "score": _buffett_score},
    "graham": {"filter": _graham_filter, "score": _graham_score},
    "lynch": {"filter": _lynch_filter, "score": _lynch_score},
    "greenblatt": {"filter": _greenblatt_filter, "score": _greenblatt_score},
    "munger": {"filter": _munger_filter, "score": _munger_score},
    "fisher": {"filter": _fisher_filter, "score": _fisher_score},
    "druckenmiller": {"filter": _druckenmiller_filter, "score": _druckenmiller_score},
}


@router.get("/legends/{strategy_id}/matches")
def get_strategy_matches(
    strategy_id: str,
    market: str = Query("BIST", pattern="^(BIST|US)$"),
    limit: int = Query(20, ge=1, le=100),
):
    if strategy_id not in STRATEGIES:
        raise HTTPException(status_code=404, detail=f"Unknown strategy: {strategy_id}")

    cache_key = f"legends_v2:{strategy_id}:{market}:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    strat = STRATEGIES[strategy_id]
    tickers = _load_tickers(market)

    matches = []
    for item in tickers:
        ticker = item["ticker"]
        ratios = get_ratios(ticker)
        if not ratios:
            continue
        try:
            if not strat["filter"](ratios):
                continue
        except Exception:
            continue

        try:
            score = strat["score"](ratios)
        except Exception:
            score = 0

        quote = get_quote(ticker) or {}
        matches.append({
            "ticker": ticker,
            "name": item.get("name") or quote.get("name") or ticker,
            "sector": item.get("sector"),
            "currentPrice": quote.get("currentPrice"),
            "changePercent": quote.get("changePercent"),
            "currency": quote.get("currency"),
            "marketCap": quote.get("marketCap"),
            "pe": ratios.get("pe"),
            "pb": ratios.get("pb"),
            "roe": ratios.get("roe"),
            "netMargin": ratios.get("netMargin"),
            "debtToEquity": ratios.get("debtToEquity"),
            "revenueGrowth": ratios.get("revenueGrowth"),
            "earningsGrowth": ratios.get("earningsGrowth"),
            "peg": ratios.get("peg"),
            "dividendYield": ratios.get("dividendYield"),
            "score": score,
        })

    matches.sort(key=lambda m: m["score"], reverse=True)
    matches = matches[:limit]

    result = {"strategy": strategy_id, "market": market, "matches": matches}
    cache.set(cache_key, result, ttl=3600)
    return result
