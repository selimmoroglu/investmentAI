"""Bilanço analiz servisi — gelir/marj/borç/FCF trendleri + kural tabanlı uzun vade yorumu.

Dört yıllık finansal geçmişi analiz ederek:
- Büyüme trendi (CAGR ve son yıl YoY)
- Kar marjı değişimi
- Borç / özsermaye gelişimi
- Serbest nakit akışı trendi
- ROE / ROA kalitesi
- Sinyaller (pozitif / negatif / uyarı)
- Otomatik uzun vade yorum metni
"""

import math
from typing import Optional
import yfinance as yf
from .cache import cache
from .quality_scores import _row_values, _to_float, _at, _is_financial_company


def _safe(v) -> Optional[float]:
    try:
        if v is None:
            return None
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _cagr(start: Optional[float], end: Optional[float], years: int) -> Optional[float]:
    if start is None or end is None or start <= 0 or years <= 0:
        return None
    return (end / start) ** (1.0 / years) - 1


def _yoy(curr: Optional[float], prev: Optional[float]) -> Optional[float]:
    if curr is None or prev is None or prev == 0:
        return None
    return (curr - prev) / abs(prev)


def _trend(values: list[Optional[float]]) -> str:
    """Son 3+ değere bakarak 'improving' / 'declining' / 'stable' döner."""
    vals = [v for v in values if v is not None]
    if len(vals) < 2:
        return "stable"
    increases = sum(1 for i in range(1, len(vals)) if vals[i] > vals[i - 1])
    total = len(vals) - 1
    ratio = increases / total
    if ratio >= 0.67:
        return "improving"
    if ratio <= 0.33:
        return "declining"
    return "stable"


def _fmt_pct(v: Optional[float]) -> str:
    if v is None:
        return "—"
    sign = "+" if v >= 0 else ""
    return f"{sign}{v * 100:.1f}%"


def _build_commentary(
    ticker: str,
    name: str,
    is_financial: bool,
    rev_cagr: Optional[float],
    rev_trend: str,
    net_margin_vals: list[Optional[float]],
    net_margin_trend: str,
    de_trend: str,
    de_vals: list[Optional[float]],
    fcf_trend: str,
    roe: Optional[float],
    roa: Optional[float],
    piotroski_score: Optional[int],
    verdict: str,
    years: int,
) -> str:
    short = ticker.split(".")[0]
    parts = []

    # Büyüme
    if rev_cagr is not None:
        cagr_txt = f"%{rev_cagr * 100:.0f}"
        if rev_cagr >= 0.25:
            parts.append(f"{short}, son {years} yılda güçlü gelir büyümesi ({cagr_txt} CAGR) sergiledi.")
        elif rev_cagr >= 0.10:
            parts.append(f"{short}, son {years} yılda istikrarlı gelir büyümesi ({cagr_txt} CAGR) kaydetti.")
        elif rev_cagr >= 0:
            parts.append(f"{short}, son {years} yılda sınırlı gelir büyümesi ({cagr_txt} CAGR) gösterdi.")
        else:
            parts.append(f"{short}, son {years} yılda gelirinde gerileme ({cagr_txt} CAGR) yaşadı.")

    # Marj trendi
    valid_margins = [v for v in net_margin_vals if v is not None]
    if len(valid_margins) >= 2:
        first_m = valid_margins[-1]
        last_m = valid_margins[0]
        if net_margin_trend == "improving":
            parts.append(
                f"Net kâr marjı yükseliş trendinde (%{first_m * 100:.1f} → %{last_m * 100:.1f}), "
                "kâr kalitesi güçlenmiştir."
            )
        elif net_margin_trend == "declining":
            parts.append(
                f"Net kâr marjı daralma trendinde (%{first_m * 100:.1f} → %{last_m * 100:.1f}), "
                "maliyet baskısı dikkat gerektirmektedir."
            )
        else:
            parts.append(
                f"Net kâr marjı %{last_m * 100:.1f} düzeyinde seyredip yatay seyretti."
            )

    # Borç durumu (finansal şirketler için atla)
    if not is_financial:
        valid_de = [v for v in de_vals if v is not None]
        if valid_de:
            curr_de = valid_de[0]
            if de_trend == "decreasing":
                parts.append(
                    f"Borç/özsermaye oranı ({curr_de:.2f}x) azalış trendinde — bilanço güçlenme sinyali."
                )
            elif de_trend == "increasing" and curr_de > 1.5:
                parts.append(
                    f"Borç/özsermaye oranı ({curr_de:.2f}x) yükseliyor — kaldıraç riski yakın takip gerektirir."
                )
            elif curr_de <= 0.5:
                parts.append(
                    f"Borç yükü çok düşük ({curr_de:.2f}x), güçlü bir bilanço yapısı mevcut."
                )
            elif curr_de <= 1.0:
                parts.append(
                    f"Borç/özsermaye oranı ({curr_de:.2f}x) makul seviyede ve kontrol altında."
                )

    # FCF
    if fcf_trend == "improving":
        parts.append("Serbest nakit akışı artış trendinde — şirket nakit üretme kapasitesini güçlendiriyor.")
    elif fcf_trend == "declining":
        parts.append("Serbest nakit akışı zayıflıyor — yatırım harcamaları veya kâr kalitesi izlenmelidir.")

    # ROE
    if roe is not None:
        if roe >= 0.20:
            parts.append(f"Özsermaye kârlılığı (ROE %{roe * 100:.1f}) sektör üstü düzeyde.")
        elif roe >= 0.12:
            parts.append(f"Özsermaye kârlılığı (ROE %{roe * 100:.1f}) tatmin edici düzeyde.")
        elif roe < 0:
            parts.append(f"Özsermaye kârlılığı negatif (ROE %{roe * 100:.1f}) — geçici mi kalıcı mı izlenmeli.")

    # Piotroski
    if piotroski_score is not None:
        if piotroski_score >= 7:
            parts.append(f"Piotroski F-Skoru ({piotroski_score}/9) finansal sağlığın güçlü olduğuna işaret eder.")
        elif piotroski_score <= 3:
            parts.append(f"Piotroski F-Skoru ({piotroski_score}/9) zayıf — temel sağlık kriterleri dikkatle değerlendirilmeli.")

    # Final verdict cümlesi
    if verdict == "Çok Olumlu":
        parts.append(
            "Sonuç olarak, şirket birden fazla alanda güçlü temel göstergeler sunmakta; uzun vade için öne çıkan yatırım adayları arasında yer almaktadır."
        )
    elif verdict == "Olumlu":
        parts.append(
            "Sonuç olarak, olumlu büyüme eğilimleri ve sağlam bilanço yapısıyla uzun vadeli yatırımcılar için cazip bir profil sergilenmektedir."
        )
    elif verdict == "Nötr":
        parts.append(
            "Sonuç olarak, güçlü ve zayıf yönler dengeli dağılmış; mevcut değerleme seviyesinde yakın takip ve seçici yaklaşım önerilir."
        )
    elif verdict == "Dikkatli":
        parts.append(
            "Sonuç olarak, bilanço veya kârlılık tarafında dikkat gerektiren sinyaller mevcut; uzun vadeli taahhüt öncesinde derinlemesine inceleme önerilir."
        )
    else:
        parts.append(
            "Sonuç olarak, temel göstergeler zayıf seyretmektedir. Uzun vadeli alım öncesinde şirketin toparlanma potansiyeli tartışılmalıdır."
        )

    return " ".join(parts)


def analyze_balance_sheet(ticker: str) -> Optional[dict]:
    """Ticker için kapsamlı bilanço trendi analizi + uzun vade yorumu."""
    cache_key = f"bs_analysis_v2:{ticker}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        inc = t.financials       # Annual income statement
        bal = t.balance_sheet    # Annual balance sheet
        cf  = t.cashflow         # Annual cash flow
        info = t.info or {}
    except Exception:
        return None

    if inc is None or bal is None or inc.empty or bal.empty:
        return None

    is_financial = _is_financial_company(ticker, info)

    # ── Tarih etiketleri ──────────────────────────────────────────────────────
    try:
        dates = [str(c.year) for c in inc.columns][:4]
    except Exception:
        dates = []

    # ── Gelir (Revenue) ───────────────────────────────────────────────────────
    rev_vals_raw = _row_values(
        inc,
        ["Total Revenue", "Operating Revenue", "Revenue",
         "Interest Income", "Net Interest Income", "Total Net Revenue"],
    )
    rev_vals: list[Optional[float]] = [_at(rev_vals_raw, i) for i in range(4)]
    rev_valid = [v for v in rev_vals if v is not None]

    rev_cagr: Optional[float] = None
    rev_last_yoy: Optional[float] = None
    if len(rev_valid) >= 2:
        rev_cagr = _cagr(rev_valid[-1], rev_valid[0], len(rev_valid) - 1)
        rev_last_yoy = _yoy(rev_valid[0], rev_valid[1])

    # ── Net Kar & Marjlar ─────────────────────────────────────────────────────
    ni_vals_raw = _row_values(inc, ["Net Income", "Net Income Common Stockholders", "Net Income From Continuing Operation Net Minority Interest"])
    ni_vals: list[Optional[float]] = [_at(ni_vals_raw, i) for i in range(4)]

    gross_vals_raw = _row_values(inc, ["Gross Profit"])
    gross_vals: list[Optional[float]] = [_at(gross_vals_raw, i) for i in range(4)]

    net_margin_vals: list[Optional[float]] = []
    gross_margin_vals: list[Optional[float]] = []
    op_income_vals_raw = _row_values(inc, ["Operating Income", "Total Operating Income As Reported", "EBIT"])
    op_income_vals: list[Optional[float]] = [_at(op_income_vals_raw, i) for i in range(4)]

    for i in range(4):
        r = rev_vals[i]
        ni = ni_vals[i]
        gp = gross_vals[i]
        net_margin_vals.append((ni / r) if (ni is not None and r and r > 0) else None)
        gross_margin_vals.append((gp / r) if (gp is not None and r and r > 0) else None)

    net_margin_trend = _trend(net_margin_vals)
    gross_margin_trend = _trend(gross_margin_vals)

    # ── Borç / Özsermaye ─────────────────────────────────────────────────────
    total_debt_raw = _row_values(bal, ["Total Debt", "Long Term Debt And Capital Lease Obligation", "Long Term Debt"])
    equity_raw = _row_values(bal, ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"])
    total_assets_raw = _row_values(bal, ["Total Assets"])

    de_vals: list[Optional[float]] = []
    for i in range(4):
        d = _at(total_debt_raw, i)
        e = _at(equity_raw, i)
        de_vals.append((d / e) if (d is not None and e and e > 0) else None)
    de_trend_str = _trend([(-v if v is not None else None) for v in de_vals])  # invert: debt decrease = improving
    de_trend_label = "decreasing" if de_trend_str == "improving" else ("increasing" if de_trend_str == "declining" else "stable")

    # ── Serbest Nakit Akışı ───────────────────────────────────────────────────
    ocf_raw = _row_values(cf, ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"]) if cf is not None and not cf.empty else None
    capex_raw = _row_values(cf, ["Capital Expenditure", "Purchase Of PPE", "Capital Expenditures"]) if cf is not None and not cf.empty else None

    fcf_vals: list[Optional[float]] = []
    for i in range(4):
        o = _at(ocf_raw, i)
        c = _at(capex_raw, i)
        if o is not None and c is not None:
            fcf_vals.append(o + c)  # capex typically negative in yfinance
        elif o is not None:
            fcf_vals.append(o)
        else:
            fcf_vals.append(None)

    fcf_trend = _trend(fcf_vals)

    # ── ROE / ROA ─────────────────────────────────────────────────────────────
    roe = _safe(info.get("returnOnEquity"))
    roa = _safe(info.get("returnOnAssets"))

    # ── Piotroski (from cache if available) ───────────────────────────────────
    from .quality_scores import piotroski_f_score as _pio
    pio_raw = _pio(ticker)
    piotroski_score: Optional[int] = pio_raw["score"] if pio_raw else None

    # ── Sinyaller ─────────────────────────────────────────────────────────────
    signals: list[dict] = []

    if rev_cagr is not None:
        if rev_cagr >= 0.20:
            signals.append({"type": "positive", "category": "growth", "text": f"Gelir {len(rev_valid)-1} yılda güçlü büyüdü (+{rev_cagr*100:.0f}% CAGR)"})
        elif rev_cagr >= 0.05:
            signals.append({"type": "positive", "category": "growth", "text": f"Gelir istikrarlı büyüdü (+{rev_cagr*100:.0f}% CAGR)"})
        elif rev_cagr < 0:
            signals.append({"type": "negative", "category": "growth", "text": f"Gelir geriledi ({rev_cagr*100:.0f}% CAGR)"})

    if net_margin_trend == "improving":
        cur_nm = next((v for v in net_margin_vals if v is not None), None)
        signals.append({"type": "positive", "category": "margin", "text": f"Net kar marjı yükseliyor (şu an %{(cur_nm or 0)*100:.1f})"})
    elif net_margin_trend == "declining":
        signals.append({"type": "negative", "category": "margin", "text": "Net kar marjı daralıyor — maliyet baskısı var"})

    if not is_financial:
        if de_trend_label == "decreasing":
            signals.append({"type": "positive", "category": "debt", "text": "Borç/özsermaye oranı azalıyor — bilanço güçleniyor"})
        elif de_trend_label == "increasing" and de_vals[0] is not None and de_vals[0] > 1.5:
            signals.append({"type": "negative", "category": "debt", "text": f"Borç yükü artıyor ({de_vals[0]:.1f}x) — kaldıraç riski"})
        curr_de = next((v for v in de_vals if v is not None), None)
        if curr_de is not None and curr_de <= 0.3:
            signals.append({"type": "positive", "category": "debt", "text": f"Düşük borç yükü ({curr_de:.2f}x) — sağlam bilanço"})

    if fcf_trend == "improving":
        signals.append({"type": "positive", "category": "fcf", "text": "Serbest nakit akışı artış trendinde"})
    elif fcf_trend == "declining":
        signals.append({"type": "warning", "category": "fcf", "text": "Serbest nakit akışı zayıflıyor"})

    if roe is not None:
        if roe >= 0.20:
            signals.append({"type": "positive", "category": "quality", "text": f"Yüksek özsermaye kârlılığı (ROE %{roe*100:.0f})"})
        elif roe < 0:
            signals.append({"type": "negative", "category": "quality", "text": f"Özsermaye kârlılığı negatif (ROE %{roe*100:.1f})"})

    if piotroski_score is not None:
        if piotroski_score >= 7:
            signals.append({"type": "positive", "category": "quality", "text": f"Yüksek Piotroski F-Skoru ({piotroski_score}/9)"})
        elif piotroski_score <= 3:
            signals.append({"type": "negative", "category": "quality", "text": f"Düşük Piotroski F-Skoru ({piotroski_score}/9)"})

    # Gross marj
    if gross_margin_trend == "improving":
        cur_gm = next((v for v in gross_margin_vals if v is not None), None)
        if cur_gm and cur_gm > 0.3:
            signals.append({"type": "positive", "category": "margin", "text": f"Brüt marj genişliyor ve yüksek (%{cur_gm*100:.0f})"})

    # ── Verdict puanı ─────────────────────────────────────────────────────────
    pos_count = sum(1 for s in signals if s["type"] == "positive")
    neg_count = sum(1 for s in signals if s["type"] == "negative")
    total_count = len(signals)

    if total_count == 0:
        verdict_score = 50
    else:
        verdict_score = int(40 + (pos_count / max(total_count, 1)) * 60)
        verdict_score = min(100, max(0, verdict_score))

    if verdict_score >= 75:
        verdict, verdict_color = "Çok Olumlu", "up"
    elif verdict_score >= 60:
        verdict, verdict_color = "Olumlu", "up"
    elif verdict_score >= 45:
        verdict, verdict_color = "Nötr", "warn"
    elif verdict_score >= 30:
        verdict, verdict_color = "Dikkatli", "warn"
    else:
        verdict, verdict_color = "Olumsuz", "down"

    # ── Yorum metni ───────────────────────────────────────────────────────────
    name = info.get("longName") or info.get("shortName") or ticker
    commentary = _build_commentary(
        ticker=ticker,
        name=name,
        is_financial=is_financial,
        rev_cagr=rev_cagr,
        rev_trend=_trend(rev_vals),
        net_margin_vals=net_margin_vals,
        net_margin_trend=net_margin_trend,
        de_trend=de_trend_label,
        de_vals=de_vals,
        fcf_trend=fcf_trend,
        roe=roe,
        roa=roa,
        piotroski_score=piotroski_score,
        verdict=verdict,
        years=max(len(rev_valid) - 1, 1),
    )

    # ── Sonuç ─────────────────────────────────────────────────────────────────
    def clean(vals: list) -> list:
        return [round(v, 6) if isinstance(v, float) else v for v in vals]

    result = {
        "ticker": ticker,
        "currency": info.get("currency") or ("TRY" if ticker.upper().endswith(".IS") else "USD"),
        "isFinancial": is_financial,
        "years": dates[:len(rev_valid)],

        "revenueValues": clean(rev_vals[:len(dates)]),
        "revenueCagr": round(rev_cagr, 4) if rev_cagr is not None else None,
        "revenueGrowthLastYear": round(rev_last_yoy, 4) if rev_last_yoy is not None else None,
        "revenueGrowthTrend": _trend(rev_vals),

        "netMarginValues": clean(net_margin_vals[:len(dates)]),
        "netMarginTrend": net_margin_trend,
        "currentNetMargin": round(net_margin_vals[0], 4) if net_margin_vals[0] is not None else None,

        "grossMarginValues": clean(gross_margin_vals[:len(dates)]),
        "grossMarginTrend": gross_margin_trend,
        "currentGrossMargin": round(gross_margin_vals[0], 4) if gross_margin_vals[0] is not None else None,

        "debtToEquityValues": clean(de_vals[:len(dates)]),
        "debtToEquityTrend": de_trend_label,
        "currentDebtToEquity": round(de_vals[0], 2) if de_vals[0] is not None else None,

        "fcfValues": clean(fcf_vals[:len(dates)]),
        "fcfTrend": fcf_trend,
        "currentFcf": round(fcf_vals[0], 0) if fcf_vals[0] is not None else None,

        "roe": round(roe, 4) if roe is not None else None,
        "roa": round(roa, 4) if roa is not None else None,
        "piotroskiScore": piotroski_score,

        "signals": signals[:8],  # max 8 sinyal
        "commentary": commentary,
        "longTermVerdict": verdict,
        "longTermVerdictColor": verdict_color,
        "verdictScore": verdict_score,
    }

    cache.set(cache_key, result, ttl=3600)
    return result
