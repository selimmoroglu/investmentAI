"""TR TÜFE endpoint'leri ve reel getiri hesaplayıcı."""
from datetime import datetime
from fastapi import APIRouter, HTTPException
import yfinance as yf
import pandas as pd
from ..services.cache import cache
from ..services.inflation import load_tr_cpi, inflation_between, real_return

router = APIRouter()


@router.get("/inflation/tr/series")
def get_tr_cpi_series():
    """TR TÜFE aylık endeks serisi (2003=100 bazlı yaklaşık değerler)."""
    return {"series": load_tr_cpi()}


@router.get("/inflation/tr/real-return/{ticker:path}")
def get_real_return(ticker: str):
    """Bir BIST hissesi için 1Y/3Y/5Y nominal vs TÜFE-düzeltilmiş reel getiri."""
    if not ticker.upper().endswith(".IS"):
        raise HTTPException(status_code=400, detail="Sadece BIST hisseleri (örn THYAO.IS) için reel getiri hesaplanır.")

    key = f"real_return:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        df = t.history(period="5y", interval="1d")
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Fiyat verisi bulunamadı: {ticker}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Fiyat verisi alınamadı: {e}")

    df = df.sort_index()
    close = df["Close"]
    if len(close) < 30:
        raise HTTPException(status_code=404, detail="Yeterli fiyat verisi yok")

    current_price = float(close.iloc[-1])
    end_date = close.index[-1]
    end_ym = end_date.strftime("%Y-%m")

    periods_def = [
        ("1Y", 365),
        ("3Y", 365 * 3),
        ("5Y", 365 * 5),
    ]

    results = []
    for label, days_back in periods_def:
        # En yakın geçmiş tarihi bul
        target_ts = end_date - pd.Timedelta(days=days_back)
        # close.index'te o tarihten önce olan en yakın
        past_slice = close[close.index <= target_ts]
        if past_slice.empty:
            continue
        past_price = float(past_slice.iloc[-1])
        past_date = past_slice.index[-1]
        start_ym = past_date.strftime("%Y-%m")

        if past_price <= 0:
            continue
        nominal = ((current_price - past_price) / past_price) * 100
        inflation = inflation_between(start_ym, end_ym)
        real = real_return(nominal, start_ym, end_ym)

        results.append({
            "label": label,
            "nominal": round(nominal, 2),
            "inflation": round(inflation, 2) if inflation is not None else None,
            "real": round(real, 2) if real is not None else None,
            "startDate": start_ym,
            "endDate": end_ym,
            "startPrice": round(past_price, 4),
            "endPrice": round(current_price, 4),
        })

    result = {"ticker": ticker, "periods": results}
    cache.set(key, result, ttl=3600)
    return result
