from fastapi import APIRouter, HTTPException
import yfinance as yf
import pandas as pd
from ..services.cache import cache

router = APIRouter()

# (ticker, label, group) — sıralı liste, frontend bu sırayla gösterir
INDEX_TICKERS = [
    ("XU100.IS", "BIST 100", "index"),
    ("^IXIC", "NASDAQ", "index"),
    ("USDTRY=X", "USD/TRY", "fx"),
    ("EURTRY=X", "EUR/TRY", "fx"),
    ("GC=F", "Altın (oz)", "commodity"),
    ("SI=F", "Gümüş (oz)", "commodity"),
    ("BZ=F", "Brent Petrol", "commodity"),
    ("BTC-USD", "Bitcoin", "crypto"),
]


@router.get("/indices")
def get_indices():
    key = "indices:all"
    cached = cache.get(key)
    if cached:
        return cached

    tickers = [t for t, _, _ in INDEX_TICKERS]
    result = []

    try:
        df = yf.download(
            tickers,
            period="5d",
            interval="1d",
            group_by="ticker",
            progress=False,
            threads=True,
            auto_adjust=False,
        )
    except Exception:
        df = None

    for ticker, label, group in INDEX_TICKERS:
        price = None
        prev = None

        try:
            if df is not None and not df.empty:
                # Multi-ticker download → df[ticker]["Close"]
                if ticker in df.columns.get_level_values(0):
                    closes = df[ticker]["Close"].dropna()
                    if len(closes) >= 2:
                        price = float(closes.iloc[-1])
                        prev = float(closes.iloc[-2])
                    elif len(closes) == 1:
                        price = float(closes.iloc[-1])

            # Fallback: per-ticker fetch
            if price is None:
                t = yf.Ticker(ticker)
                hist = t.history(period="5d", interval="1d")
                if not hist.empty:
                    closes = hist["Close"].dropna()
                    if len(closes) >= 2:
                        price = float(closes.iloc[-1])
                        prev = float(closes.iloc[-2])
                    elif len(closes) == 1:
                        price = float(closes.iloc[-1])
        except Exception:
            pass

        change_pct = None
        if price is not None and prev is not None and prev != 0:
            change_pct = round(((price - prev) / prev) * 100, 2)

        result.append({
            "ticker": ticker,
            "label": label,
            "group": group,
            "price": round(price, 4) if price is not None else None,
            "previousClose": round(prev, 4) if prev is not None else None,
            "changePercent": change_pct,
        })

    cache.set(key, result, ttl=120)
    return result


def _cluster_levels(levels: list[float], tol: float = 0.015) -> list[float]:
    if not levels:
        return []
    levels = sorted(levels)
    clusters: list[list[float]] = [[levels[0]]]
    for v in levels[1:]:
        if abs(v - clusters[-1][-1]) / clusters[-1][-1] < tol:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return [round(sum(c) / len(c), 4) for c in clusters]


# ticker → (label, group, sembol)
INDEX_BY_KEY = {t[0]: t for t in INDEX_TICKERS}


@router.get("/indices/{ticker:path}/analysis")
def get_index_analysis(ticker: str):
    """Endeks/varlık için teknik + valuation analizi.
    Path'te `^IXIC`, `BTC-USD`, `XU100.IS` gibi sembol gelir."""
    if ticker not in INDEX_BY_KEY:
        raise HTTPException(status_code=404, detail=f"Unknown index: {ticker}")

    key = f"index_analysis:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    label, group = INDEX_BY_KEY[ticker][1], INDEX_BY_KEY[ticker][2]

    try:
        t = yf.Ticker(ticker)
        # 5 yıllık tarih — uzun vadeli ortalamalar için
        df = t.history(period="5y", interval="1d")
        if df.empty or len(df) < 60:
            # daha kısa periyot fallback
            df = t.history(period="2y", interval="1d")
        if df.empty:
            raise ValueError("No data")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Data fetch failed: {e}")

    close = df["Close"]
    high = df["High"]
    low = df["Low"]

    current_price = float(close.iloc[-1])

    # Hareketli ortalamalar
    sma20 = float(close.rolling(20).mean().iloc[-1]) if len(close) >= 20 else None
    sma50 = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else None
    sma100 = float(close.rolling(100).mean().iloc[-1]) if len(close) >= 100 else None
    sma200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else None

    # Tarihsel istatistikler (1y)
    last_year = close.tail(252) if len(close) >= 252 else close
    year_high = float(last_year.max())
    year_low = float(last_year.min())
    year_mean = float(last_year.mean())
    year_std = float(last_year.std())

    # 52H pozisyonu (0=düşük, 1=yüksek)
    range_pos_1y = ((current_price - year_low) / (year_high - year_low)) if year_high > year_low else 0.5

    # 5Y istatistikler
    five_year_mean = float(close.mean())
    five_year_high = float(close.max())
    five_year_low = float(close.min())
    range_pos_5y = ((current_price - five_year_low) / (five_year_high - five_year_low)) if five_year_high > five_year_low else 0.5

    # Z-Score: bugünkü fiyat 1Y ortalamadan kaç std uzakta?
    z_1y = ((current_price - year_mean) / year_std) if year_std > 0 else 0

    # Destek/direnç (son 1y, 5 günlük swing high/low)
    recent = df.tail(252) if len(df) >= 252 else df
    window = 5
    supports_raw, resistances_raw = [], []
    highs_arr = recent["High"].values
    lows_arr = recent["Low"].values
    for i in range(window, len(recent) - window):
        if highs_arr[i] == max(highs_arr[i - window:i + window + 1]):
            resistances_raw.append(float(highs_arr[i]))
        if lows_arr[i] == min(lows_arr[i - window:i + window + 1]):
            supports_raw.append(float(lows_arr[i]))

    support_levels = _cluster_levels(supports_raw, 0.012)
    resistance_levels = _cluster_levels(resistances_raw, 0.012)

    nearest_supports = sorted([s for s in support_levels if s < current_price], reverse=True)[:3]
    nearest_resistances = sorted([r for r in resistance_levels if r > current_price])[:3]

    # Trend (son 100 gün lineer regresyon)
    recent_close = close.tail(100)
    n = len(recent_close)
    x_vals = list(range(n))
    sum_x = sum(x_vals)
    sum_y = sum(recent_close.values)
    sum_xy = sum(x_vals[i] * recent_close.values[i] for i in range(n))
    sum_xx = sum(xv * xv for xv in x_vals)
    slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x) if (n * sum_xx - sum_x * sum_x) else 0
    avg_p = sum_y / n
    slope_pct = (slope / avg_p) * 100 if avg_p else 0

    if slope_pct > 0.10:
        trend = "Yükseliş"
    elif slope_pct < -0.10:
        trend = "Düşüş"
    else:
        trend = "Yatay"

    # Valuation (ucuz/pahalı/normal) — basit, mean reversion mantığı
    # 5y ortalamadan sapma % + 1y z-skor karması
    deviation_5y_pct = ((current_price / five_year_mean) - 1) * 100
    if z_1y > 1.5 or deviation_5y_pct > 30:
        valuation = "Pahalı"
        valuation_color = "down"
        valuation_note = f"5 yıllık ortalamadan {deviation_5y_pct:+.1f}% sapma — tarihsel olarak yüksek seviyelerde."
    elif z_1y < -1.5 or deviation_5y_pct < -25:
        valuation = "Ucuz"
        valuation_color = "up"
        valuation_note = f"5 yıllık ortalamadan {deviation_5y_pct:+.1f}% sapma — tarihsel olarak düşük seviyelerde."
    elif z_1y > 0.7:
        valuation = "Hafif Pahalı"
        valuation_color = "warn"
        valuation_note = f"Ortalamanın {z_1y:+.1f}σ üstünde — mean reversion riski var."
    elif z_1y < -0.7:
        valuation = "Hafif Ucuz"
        valuation_color = "warn-good"
        valuation_note = f"Ortalamanın {z_1y:+.1f}σ altında — kademeli pozisyon değerlendirilebilir."
    else:
        valuation = "Adil"
        valuation_color = "neutral"
        valuation_note = f"5 yıllık ortalamaya yakın ({deviation_5y_pct:+.1f}%) — adil değerleme bölgesinde."

    # SMA pozisyonu yorumu
    ma_position = []
    for label_, val in [("SMA 50", sma50), ("SMA 100", sma100), ("SMA 200", sma200)]:
        if val is None:
            continue
        diff = ((current_price / val) - 1) * 100
        ma_position.append({
            "label": label_,
            "value": round(val, 4),
            "deviation": round(diff, 2),
            "above": current_price > val,
        })

    # Performance
    perf = {}
    for days, label_ in [(5, "1H"), (21, "1A"), (63, "3A"), (126, "6A"), (252, "1Y")]:
        if len(close) > days:
            prev = float(close.iloc[-days - 1])
            perf[label_] = round(((current_price - prev) / prev) * 100, 2) if prev else None

    # Kapatış serisi grafik için (haftalık örnekleme — son 5 yıl)
    weekly = close.resample("W").last().dropna()
    history = [
        {"time": int(pd.Timestamp(idx).timestamp()), "value": round(float(v), 4)}
        for idx, v in weekly.items()
    ]

    result = {
        "ticker": ticker,
        "label": label,
        "group": group,
        "currentPrice": round(current_price, 4),
        "trend": trend,
        "trendSlopePct": round(slope_pct, 3),
        "valuation": valuation,
        "valuationColor": valuation_color,
        "valuationNote": valuation_note,
        "deviationFromMean5y": round(deviation_5y_pct, 2),
        "zScore1y": round(z_1y, 2),
        "yearHigh": round(year_high, 4),
        "yearLow": round(year_low, 4),
        "yearMean": round(year_mean, 4),
        "rangePosition1y": round(range_pos_1y * 100, 1),
        "fiveYearHigh": round(five_year_high, 4),
        "fiveYearLow": round(five_year_low, 4),
        "fiveYearMean": round(five_year_mean, 4),
        "rangePosition5y": round(range_pos_5y * 100, 1),
        "movingAverages": ma_position,
        "support": nearest_supports,
        "resistance": nearest_resistances,
        "performance": perf,
        "history": history,
    }
    cache.set(key, result, ttl=600)
    return result
