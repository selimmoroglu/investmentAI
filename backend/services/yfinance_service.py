import yfinance as yf
import pandas as pd
from typing import Optional
from .cache import cache


def _safe_val(val):
    """Convert numpy/NaN values to JSON-serializable Python types."""
    if val is None:
        return None
    try:
        import math
        if isinstance(val, float) and math.isnan(val):
            return None
        return val.item() if hasattr(val, "item") else val
    except Exception:
        return None


def get_quote(ticker: str) -> Optional[dict]:
    key = f"quote:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        info = t.info
        if not info or "symbol" not in info:
            return None

        current = _safe_val(info.get("currentPrice") or info.get("regularMarketPrice"))
        prev_close = _safe_val(info.get("previousClose") or info.get("regularMarketPreviousClose"))
        change = round(current - prev_close, 4) if current and prev_close else None
        change_pct = round((change / prev_close) * 100, 2) if change and prev_close else None

        result = {
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName"),
            "currentPrice": current,
            "previousClose": prev_close,
            "change": change,
            "changePercent": change_pct,
            "currency": info.get("currency"),
            "volume": _safe_val(info.get("volume") or info.get("regularMarketVolume")),
            "avgVolume": _safe_val(info.get("averageVolume")),
            "marketCap": _safe_val(info.get("marketCap")),
            "pe": _safe_val(info.get("trailingPE")),
            "forwardPE": _safe_val(info.get("forwardPE")),
            "eps": _safe_val(info.get("trailingEps")),
            "dividendYield": _safe_val(info.get("dividendYield")),
            "beta": _safe_val(info.get("beta")),
            "fiftyTwoWeekHigh": _safe_val(info.get("fiftyTwoWeekHigh")),
            "fiftyTwoWeekLow": _safe_val(info.get("fiftyTwoWeekLow")),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "exchange": info.get("exchange"),
            "summary": info.get("longBusinessSummary"),
        }
        cache.set(key, result, ttl=120)
        return result
    except Exception:
        return None


def get_history(ticker: str, period: str = "6mo", interval: str = "1d") -> Optional[list]:
    key = f"history:{ticker}:{period}:{interval}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, interval=interval)
        if df.empty:
            return []

        df = df.reset_index()
        date_col = "Datetime" if "Datetime" in df.columns else "Date"

        records = []
        for _, row in df.iterrows():
            ts = row[date_col]
            # TradingView Lightweight Charts expects Unix timestamp (seconds)
            if hasattr(ts, "timestamp"):
                time_val = int(ts.timestamp())
            else:
                time_val = int(pd.Timestamp(ts).timestamp())

            records.append({
                "time": time_val,
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
            })

        ttl = 300 if interval in ("1d", "1wk", "1mo") else 60
        cache.set(key, records, ttl=ttl)
        return records
    except Exception:
        return None


def get_financials(ticker: str, statement: str = "income", freq: str = "annual") -> Optional[dict]:
    key = f"financials:{ticker}:{statement}:{freq}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)

        if statement == "income":
            df = t.financials if freq == "annual" else t.quarterly_financials
        elif statement == "balance":
            df = t.balance_sheet if freq == "annual" else t.quarterly_balance_sheet
        elif statement == "cashflow":
            df = t.cashflow if freq == "annual" else t.quarterly_cashflow
        else:
            return None

        if df is None or df.empty:
            return {"columns": [], "rows": []}

        df = df.fillna(0)
        columns = [str(c.date()) if hasattr(c, "date") else str(c) for c in df.columns]
        rows = []
        for idx, row in df.iterrows():
            rows.append({
                "label": str(idx),
                "values": [_safe_val(v) for v in row.values],
            })

        result = {"columns": columns, "rows": rows}
        cache.set(key, result, ttl=3600)
        return result
    except Exception:
        return None


def get_technicals(ticker: str) -> Optional[dict]:
    key = f"technicals:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        df = t.history(period="1y", interval="1d")
        if df.empty or len(df) < 26:
            return None

        close = df["Close"]

        # Moving averages
        sma20 = close.rolling(20).mean()
        sma50 = close.rolling(50).mean()
        sma200 = close.rolling(200).mean()
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()

        # MACD
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        histogram = macd_line - signal_line

        # RSI
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, float("nan"))
        rsi = 100 - (100 / (1 + rs))

        # Bollinger Bands
        bb_mid = close.rolling(20).mean()
        bb_std = close.rolling(20).std()
        bb_upper = bb_mid + 2 * bb_std
        bb_lower = bb_mid - 2 * bb_std

        def series_to_list(s):
            return [
                {"time": int(pd.Timestamp(idx).timestamp()), "value": round(float(v), 4)}
                for idx, v in s.dropna().items()
            ]

        result = {
            "sma20": series_to_list(sma20),
            "sma50": series_to_list(sma50),
            "sma200": series_to_list(sma200),
            "ema12": series_to_list(ema12),
            "ema26": series_to_list(ema26),
            "macd": series_to_list(macd_line),
            "macdSignal": series_to_list(signal_line),
            "macdHistogram": series_to_list(histogram),
            "rsi": series_to_list(rsi),
            "bbUpper": series_to_list(bb_upper),
            "bbMid": series_to_list(bb_mid),
            "bbLower": series_to_list(bb_lower),
        }
        cache.set(key, result, ttl=300)
        return result
    except Exception:
        return None
