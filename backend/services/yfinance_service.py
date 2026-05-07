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


def _normalize_div_yield(info: dict):
    """yfinance bazen dividendYield'i decimal (0.024) bazen yüzde (2.4) döndürür.
    Frontend her zaman *100 yaptığı için decimal'a normalize ediyoruz."""
    raw = _safe_val(info.get("dividendYield"))
    if raw is None:
        # fallback: dividendRate / currentPrice
        rate = _safe_val(info.get("dividendRate"))
        price = _safe_val(info.get("currentPrice") or info.get("regularMarketPrice"))
        if rate is not None and price and price > 0:
            return rate / price
        return None
    # 1'den büyükse yfinance % olarak vermiş demektir → decimal'a çevir
    if raw > 1:
        return raw / 100
    return raw


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
            "dividendYield": _normalize_div_yield(info),
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


def get_ratios(ticker: str) -> Optional[dict]:
    key = f"ratios:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        info = t.info
        if not info:
            return None

        result = {
            # Değerleme
            "pe": _safe_val(info.get("trailingPE")),
            "forwardPE": _safe_val(info.get("forwardPE")),
            "pb": _safe_val(info.get("priceToBook")),
            "ps": _safe_val(info.get("priceToSalesTrailing12Months")),
            "evEbitda": _safe_val(info.get("enterpriseToEbitda")),
            "evRevenue": _safe_val(info.get("enterpriseToRevenue")),
            "peg": _safe_val(info.get("pegRatio")),
            # Karlılık
            "grossMargin": _safe_val(info.get("grossMargins")),
            "operatingMargin": _safe_val(info.get("operatingMargins")),
            "netMargin": _safe_val(info.get("profitMargins")),
            "ebitdaMargin": _safe_val(
                info.get("ebitdaMargins") or
                (info.get("ebitda") / info.get("totalRevenue") if info.get("ebitda") and info.get("totalRevenue") else None)
            ),
            # Verimlilik
            "roe": _safe_val(info.get("returnOnEquity")),
            "roa": _safe_val(info.get("returnOnAssets")),
            # Borç/Likidite
            "debtToEquity": _safe_val(info.get("debtToEquity")),
            "currentRatio": _safe_val(info.get("currentRatio")),
            "quickRatio": _safe_val(info.get("quickRatio")),
            # Büyüme
            "revenueGrowth": _safe_val(info.get("revenueGrowth")),
            "earningsGrowth": _safe_val(info.get("earningsGrowth")),
            "earningsQuarterlyGrowth": _safe_val(info.get("earningsQuarterlyGrowth")),
            # Temettü
            "dividendYield": _normalize_div_yield(info),
            "payoutRatio": _safe_val(info.get("payoutRatio")),
            "dividendRate": _safe_val(info.get("dividendRate")),
            # Diğer
            "beta": _safe_val(info.get("beta")),
            "shortRatio": _safe_val(info.get("shortRatio")),
            "heldPercentInstitutions": _safe_val(info.get("heldPercentInstitutions")),
        }
        cache.set(key, result, ttl=3600)
        return result
    except Exception:
        return None


def get_sector_stats(tickers: list[str]) -> dict:
    """Compute aggregated stats (averages + change) for a list of tickers."""
    key = f"sector_stats_v2:{'|'.join(sorted(tickers[:15]))}"
    cached = cache.get(key)
    if cached:
        return cached

    pe_vals, pb_vals, ev_vals, ps_vals = [], [], [], []
    roe_vals, net_margin_vals, div_yield_vals = [], [], []
    change_vals: list[float] = []

    for ticker in tickers[:15]:
        ratios = get_ratios(ticker)
        if ratios:
            if ratios.get("pe") and ratios["pe"] > 0:
                pe_vals.append(ratios["pe"])
            if ratios.get("pb") and ratios["pb"] > 0:
                pb_vals.append(ratios["pb"])
            if ratios.get("evEbitda") and ratios["evEbitda"] > 0:
                ev_vals.append(ratios["evEbitda"])
            if ratios.get("ps") and ratios["ps"] > 0:
                ps_vals.append(ratios["ps"])
            if ratios.get("roe") is not None:
                roe_vals.append(ratios["roe"])
            if ratios.get("netMargin") is not None:
                net_margin_vals.append(ratios["netMargin"])
            if ratios.get("dividendYield") is not None:
                div_yield_vals.append(ratios["dividendYield"])

        q = get_quote(ticker)
        if q and q.get("changePercent") is not None:
            change_vals.append(q["changePercent"])

    def avg(lst, decimals=2):
        return round(sum(lst) / len(lst), decimals) if lst else None

    # Median for P/E to be more robust against outliers
    def median(lst):
        if not lst:
            return None
        sorted_lst = sorted(lst)
        n = len(sorted_lst)
        if n % 2:
            return round(sorted_lst[n // 2], 2)
        return round((sorted_lst[n // 2 - 1] + sorted_lst[n // 2]) / 2, 2)

    result = {
        "avgPE": avg(pe_vals),
        "medianPE": median(pe_vals),
        "avgPB": avg(pb_vals),
        "avgEVEBITDA": avg(ev_vals),
        "avgPS": avg(ps_vals),
        "avgROE": avg(roe_vals, 4),
        "avgNetMargin": avg(net_margin_vals, 4),
        "avgDividendYield": avg(div_yield_vals, 4),
        "avgChangePercent": avg(change_vals),
        "stockCount": len(tickers),
        "ratedCount": len(pe_vals),
    }
    cache.set(key, result, ttl=3600)
    return result


def get_technicals(ticker: str) -> Optional[dict]:
    key = f"technicals_v2:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        df = t.history(period="1y", interval="1d")
        if df.empty or len(df) < 26:
            return None

        close = df["Close"]
        high = df["High"]
        low = df["Low"]

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

        # Support / Resistance — pivot points (son 60 gün, swing high/low)
        recent = df.tail(180)
        window = 5
        supports = []
        resistances = []
        highs = recent["High"].values
        lows = recent["Low"].values
        for i in range(window, len(recent) - window):
            # Swing high
            if highs[i] == max(highs[i - window:i + window + 1]):
                resistances.append(float(highs[i]))
            # Swing low
            if lows[i] == min(lows[i - window:i + window + 1]):
                supports.append(float(lows[i]))

        # Cluster nearby levels (within 2% of each other)
        def cluster_levels(levels: list[float], tol: float = 0.02) -> list[float]:
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

        current_price = float(close.iloc[-1])
        support_levels = cluster_levels(supports)
        resistance_levels = cluster_levels(resistances)
        # Sadece güncel fiyatın altındakileri destek, üstündekileri direnç olarak sınırla
        nearest_supports = sorted([s for s in support_levels if s < current_price], reverse=True)[:3]
        nearest_resistances = sorted([r for r in resistance_levels if r > current_price])[:3]

        # Trend yönü (son 50 günde linear regression slope)
        recent_close = close.tail(50)
        x = list(range(len(recent_close)))
        n = len(x)
        sum_x = sum(x)
        sum_y = sum(recent_close.values)
        sum_xy = sum(x[i] * recent_close.values[i] for i in range(n))
        sum_xx = sum(xv * xv for xv in x)
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x * sum_x) if (n * sum_xx - sum_x * sum_x) else 0
        avg_price = sum_y / n
        # Slope'u yüzdelik günlük değişim olarak normalize et
        slope_pct = (slope / avg_price) * 100 if avg_price else 0

        if slope_pct > 0.15:
            trend = "Yükseliş"
        elif slope_pct < -0.15:
            trend = "Düşüş"
        else:
            trend = "Yatay"

        # Trend kanalı: son 50 günün lineer regresyon ekseni + ±2σ
        trend_intercept = (sum_y - slope * sum_x) / n
        residuals = [recent_close.values[i] - (slope * x[i] + trend_intercept) for i in range(n)]
        std_dev = (sum(r * r for r in residuals) / n) ** 0.5
        # Çizgi koordinatları için kanal (zaman + değer)
        ts_recent = [int(pd.Timestamp(idx).timestamp()) for idx in recent_close.index]
        channel_mid = [round(slope * i + trend_intercept, 4) for i in x]
        channel_upper = [round(v + 2 * std_dev, 4) for v in channel_mid]
        channel_lower = [round(v - 2 * std_dev, 4) for v in channel_mid]

        def series_to_list(s):
            return [
                {"time": int(pd.Timestamp(idx).timestamp()), "value": round(float(v), 4)}
                for idx, v in s.dropna().items()
            ]

        def zip_series(times, values):
            return [{"time": t, "value": v} for t, v in zip(times, values)]

        # Sinyal özeti
        sma20_last = float(sma20.iloc[-1]) if not pd.isna(sma20.iloc[-1]) else None
        sma50_last = float(sma50.iloc[-1]) if not pd.isna(sma50.iloc[-1]) else None
        sma200_last = float(sma200.iloc[-1]) if not pd.isna(sma200.iloc[-1]) else None
        rsi_last = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else None
        macd_last = float(macd_line.iloc[-1]) if not pd.isna(macd_line.iloc[-1]) else None
        macd_signal_last = float(signal_line.iloc[-1]) if not pd.isna(signal_line.iloc[-1]) else None

        signals = {"bullish": 0, "bearish": 0, "neutral": 0}
        # MA sinyalleri
        if sma50_last and current_price > sma50_last:
            signals["bullish"] += 1
        elif sma50_last:
            signals["bearish"] += 1
        if sma200_last and current_price > sma200_last:
            signals["bullish"] += 1
        elif sma200_last:
            signals["bearish"] += 1
        if sma50_last and sma200_last and sma50_last > sma200_last:
            signals["bullish"] += 1
        elif sma50_last and sma200_last:
            signals["bearish"] += 1
        # RSI
        if rsi_last is not None:
            if rsi_last > 70: signals["bearish"] += 1  # aşırı alım → düzeltme riski
            elif rsi_last < 30: signals["bullish"] += 1  # aşırı satım → toparlama
            else: signals["neutral"] += 1
        # MACD
        if macd_last is not None and macd_signal_last is not None:
            if macd_last > macd_signal_last: signals["bullish"] += 1
            else: signals["bearish"] += 1

        if signals["bullish"] - signals["bearish"] >= 2:
            overall = "Pozitif"
        elif signals["bearish"] - signals["bullish"] >= 2:
            overall = "Negatif"
        else:
            overall = "Nötr"

        result = {
            "currentPrice": round(current_price, 4),
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
            "support": nearest_supports,
            "resistance": nearest_resistances,
            "trend": trend,
            "trendSlopePct": round(slope_pct, 3),
            "channelMid": zip_series(ts_recent, channel_mid),
            "channelUpper": zip_series(ts_recent, channel_upper),
            "channelLower": zip_series(ts_recent, channel_lower),
            "summary": {
                "overall": overall,
                "rsi": round(rsi_last, 1) if rsi_last is not None else None,
                "rsiLabel": ("Aşırı Alım" if rsi_last and rsi_last > 70 else "Aşırı Satım" if rsi_last and rsi_last < 30 else "Nötr") if rsi_last is not None else None,
                "macdSignal": "Pozitif" if (macd_last is not None and macd_signal_last is not None and macd_last > macd_signal_last) else "Negatif" if macd_last is not None else None,
                "priceVsSMA50": round(((current_price / sma50_last) - 1) * 100, 2) if sma50_last else None,
                "priceVsSMA200": round(((current_price / sma200_last) - 1) * 100, 2) if sma200_last else None,
                "goldenCross": bool(sma50_last and sma200_last and sma50_last > sma200_last),
            },
        }
        cache.set(key, result, ttl=300)
        return result
    except Exception:
        return None
