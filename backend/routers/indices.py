from fastapi import APIRouter
import yfinance as yf
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
