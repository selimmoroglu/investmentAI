"""Portföy performans endpoint — birden fazla hisse için dönemsel fiyat verileri."""
import yfinance as yf
from fastapi import APIRouter, Query, HTTPException
from ..services.cache import cache

router = APIRouter()


def _safe_float(v):
    try:
        import math
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except Exception:
        return None


@router.get("/portfolio/perf")
def get_portfolio_perf(tickers: str = Query(..., description="Virgülle ayrılmış ticker listesi, max 50")):
    """Portföy hisseleri için günlük/haftalık/aylık/yıllık fiyat performansı.

    Her hisse için döner:
    - currentPrice: son kapanış
    - prevClose: bir önceki kapanış (günlük için)
    - weekAgoPrice: ~5 işlem günü önce
    - monthAgoPrice: ~22 işlem günü önce
    - yearAgoPrice: ~252 işlem günü önce
    - changePercent1d/1w/1m/1y: dönemsel % değişimler
    - currency, name
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:50]
    if not ticker_list:
        raise HTTPException(400, "En az 1 ticker belirtin")

    result = {}

    for ticker in ticker_list:
        item_key = f"portperf:{ticker}"
        cached = cache.get(item_key)
        if cached:
            result[ticker] = cached
            continue

        try:
            t = yf.Ticker(ticker)
            info = t.info or {}
            hist = t.history(period="1y", auto_adjust=True)

            if hist is None or len(hist) < 2:
                # Son çare: sadece info'dan current price
                current = _safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
                prev = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
                if current is None:
                    continue
                item = {
                    "currentPrice": current,
                    "prevClose": prev,
                    "weekAgoPrice": None,
                    "monthAgoPrice": None,
                    "yearAgoPrice": None,
                    "changePercent1d": round((current - prev) / prev * 100, 2) if prev and prev != 0 else None,
                    "changePercent1w": None,
                    "changePercent1m": None,
                    "changePercent1y": None,
                    "currency": info.get("currency") or ("TRY" if ticker.endswith(".IS") else "USD"),
                    "name": info.get("shortName") or info.get("longName") or ticker,
                }
                result[ticker] = item
                cache.set(item_key, item, ttl=300)
                continue

            close = hist["Close"]
            n = len(close)
            current = _safe_float(close.iloc[-1])
            if current is None:
                continue

            prev_close = _safe_float(close.iloc[-2])
            # Yaklaşık dönem endeksleri (trading days)
            week_price = _safe_float(close.iloc[max(0, n - 6)])
            month_price = _safe_float(close.iloc[max(0, n - 23)])
            year_price = _safe_float(close.iloc[0])

            def pct(past):
                if past is None or past == 0:
                    return None
                return round((current - past) / past * 100, 2)

            item = {
                "currentPrice": round(current, 4),
                "prevClose": round(prev_close, 4) if prev_close else None,
                "weekAgoPrice": round(week_price, 4) if week_price else None,
                "monthAgoPrice": round(month_price, 4) if month_price else None,
                "yearAgoPrice": round(year_price, 4) if year_price else None,
                "changePercent1d": pct(prev_close),
                "changePercent1w": pct(week_price),
                "changePercent1m": pct(month_price),
                "changePercent1y": pct(year_price),
                "currency": info.get("currency") or ("TRY" if ticker.endswith(".IS") else "USD"),
                "name": info.get("shortName") or info.get("longName") or ticker,
            }
            result[ticker] = item
            cache.set(item_key, item, ttl=300)

        except Exception:
            continue

    return result


@router.get("/portfolio/quote/{ticker:path}")
def validate_ticker(ticker: str):
    """Ticker doğrulama — portföye eklemeden önce hissenin var olup olmadığını kontrol et."""
    cache_key = f"portquote:{ticker}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        price = _safe_float(
            info.get("currentPrice") or info.get("regularMarketPrice") or
            info.get("previousClose") or info.get("regularMarketPreviousClose")
        )
        if not info.get("symbol") and price is None:
            raise HTTPException(404, f"Hisse bulunamadı: {ticker}")

        result = {
            "ticker": ticker,
            "name": info.get("shortName") or info.get("longName") or ticker,
            "currency": info.get("currency") or ("TRY" if ticker.upper().endswith(".IS") else "USD"),
            "currentPrice": price,
            "market": "BIST" if ticker.upper().endswith(".IS") else "US",
            "sector": info.get("sector") or "",
        }
        cache.set(cache_key, result, ttl=3600)
        return result
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(404, f"Hisse bilgisi alınamadı: {ticker}")
