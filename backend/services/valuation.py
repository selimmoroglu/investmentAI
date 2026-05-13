"""DCF (Discounted Cash Flow) + Composite 'Uzun Vade Skoru'.

DCF: 5 yıllık projected FCF + terminal value, WACC ile iskonto.
Composite: Quality + Value + Growth + Yield → 0-100 skor.
"""
from typing import Optional
import yfinance as yf
from .cache import cache
from .yfinance_service import get_quote, get_ratios
from .quality_scores import piotroski_f_score, altman_z_score


def _safe(v) -> Optional[float]:
    try:
        if v is None:
            return None
        import math
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


# --- DCF ---

def dcf_intrinsic_value(
    ticker: str,
    growth_5y: float = 0.10,
    terminal_growth: float = 0.025,
    discount_rate: float = 0.10,
) -> Optional[dict]:
    """DCF: son FCF'den başlayarak 5 yıl projected + terminal value.

    Formül:
    - Year 1-5 FCF: fcf_0 * (1+g)^i
    - PV of each year: future_fcf / (1+d)^i
    - Terminal value (Gordon): fcf_5 * (1+tg) / (d - tg)
    - Fair Value (Enterprise) = sum(PV) + PV(Terminal)
    - Equity Value = EV − Net Debt
    - Fair Value per Share = Equity Value / shares
    """
    quote = get_quote(ticker)
    if not quote:
        return None

    # FCF kaynağı: önce info.freeCashflow, yoksa cashflow statement'ından
    fcf = _safe(quote.get("freeCashflow"))
    if fcf is None or fcf == 0:
        try:
            t = yf.Ticker(ticker)
            cf = t.cashflow
            if cf is not None and not cf.empty:
                for label in cf.index:
                    if "Free Cash Flow" in str(label):
                        fcf = _safe(cf.loc[label].iloc[0])
                        if fcf is not None:
                            break
        except Exception:
            pass

    if fcf is None or fcf <= 0:
        return {
            "error": "FCF negatif veya hesaplanamıyor — DCF uygulanamaz.",
            "fairValuePerShare": None,
            "currentPrice": quote.get("currentPrice"),
            "upsidePct": None,
        }

    shares = _safe(quote.get("sharesOutstanding"))
    current_price = _safe(quote.get("currentPrice"))
    total_debt = _safe(quote.get("totalDebt")) or 0
    total_cash = _safe(quote.get("totalCash")) or 0
    net_debt = total_debt - total_cash

    if not shares or shares <= 0:
        return {"error": "Hisse sayısı bulunamadı", "fairValuePerShare": None, "currentPrice": current_price, "upsidePct": None}

    # 5-yıl FCF projection + PV
    pv_sum = 0.0
    yearly = []
    fcf_n = fcf
    for year in range(1, 6):
        fcf_n = fcf_n * (1 + growth_5y)
        pv = fcf_n / ((1 + discount_rate) ** year)
        pv_sum += pv
        yearly.append({"year": year, "fcf": round(fcf_n, 2), "pv": round(pv, 2)})

    # Terminal value
    if discount_rate <= terminal_growth:
        return {"error": "İskonto oranı terminal büyümeden büyük olmalı", "fairValuePerShare": None, "currentPrice": current_price, "upsidePct": None}
    terminal_value = fcf_n * (1 + terminal_growth) / (discount_rate - terminal_growth)
    pv_terminal = terminal_value / ((1 + discount_rate) ** 5)

    enterprise_value = pv_sum + pv_terminal
    equity_value = enterprise_value - net_debt
    fair_value_per_share = equity_value / shares

    upside_pct = None
    if current_price and current_price > 0:
        upside_pct = ((fair_value_per_share - current_price) / current_price) * 100

    # Sensitivity table (growth ±2pp, discount ±1pp)
    sensitivity = []
    for dg in [-0.02, 0, 0.02]:
        row = {"growthDelta": dg, "values": []}
        for dd in [-0.01, 0, 0.01]:
            g = growth_5y + dg
            d = discount_rate + dd
            if d <= terminal_growth:
                row["values"].append({"discountDelta": dd, "fairValue": None, "upsidePct": None})
                continue
            fcf_s = fcf
            psum = 0.0
            for y in range(1, 6):
                fcf_s = fcf_s * (1 + g)
                psum += fcf_s / ((1 + d) ** y)
            tv = fcf_s * (1 + terminal_growth) / (d - terminal_growth)
            ev_s = psum + tv / ((1 + d) ** 5)
            eq_s = ev_s - net_debt
            fv_s = eq_s / shares
            up_s = ((fv_s - current_price) / current_price) * 100 if current_price else None
            row["values"].append({"discountDelta": dd, "fairValue": round(fv_s, 2), "upsidePct": round(up_s, 2) if up_s is not None else None})
        sensitivity.append(row)

    return {
        "currentPrice": current_price,
        "fairValuePerShare": round(fair_value_per_share, 2),
        "upsidePct": round(upside_pct, 2) if upside_pct is not None else None,
        "currency": quote.get("currency"),
        "inputs": {
            "growth5y": growth_5y,
            "terminalGrowth": terminal_growth,
            "discountRate": discount_rate,
            "startingFcf": round(fcf, 2),
            "sharesOutstanding": shares,
            "netDebt": round(net_debt, 2),
        },
        "yearly": yearly,
        "terminalValuePresent": round(pv_terminal, 2),
        "enterpriseValue": round(enterprise_value, 2),
        "equityValue": round(equity_value, 2),
        "sensitivity": sensitivity,
    }


# --- Composite Long-Term Score ---

def composite_long_term_score(ticker: str) -> Optional[dict]:
    """Quality + Value + Growth + Yield → 0-100 composite skor."""
    cache_key = f"composite:{ticker}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    ratios = get_ratios(ticker) or {}
    quote = get_quote(ticker) or {}
    pio = piotroski_f_score(ticker)
    alt = altman_z_score(ticker)

    if not ratios and not pio:
        return None

    # --- Quality (0-100, from Piotroski + margins + Altman) ---
    quality = 50.0  # neutral default
    if pio:
        quality = (pio["score"] / 9) * 70  # 9 puan → 70 puan
    if alt:
        if alt["zone"] == "Güvenli":
            quality += 20
        elif alt["zone"] == "Gri":
            quality += 10
    # Margin bonus
    nm = _safe(ratios.get("netMargin"))
    if nm is not None:
        if nm > 0.15: quality += 5
        elif nm > 0.05: quality += 2
        elif nm < 0: quality -= 10
    quality = max(0, min(100, quality))

    # --- Value (0-100, lower P/E + P/B = higher score) ---
    value = 50.0
    pe = _safe(ratios.get("pe"))
    pb = _safe(ratios.get("pb"))
    ev_eb = _safe(ratios.get("evEbitda"))
    components = 0
    score_acc = 0.0
    if pe is not None and pe > 0:
        # Düşük P/E → yüksek skor. P/E 5 → 100, P/E 40 → 0
        score_acc += max(0, min(100, 100 - ((pe - 5) / 35) * 100))
        components += 1
    if pb is not None and pb > 0:
        score_acc += max(0, min(100, 100 - ((pb - 0.5) / 5) * 100))
        components += 1
    if ev_eb is not None and ev_eb > 0:
        score_acc += max(0, min(100, 100 - ((ev_eb - 5) / 25) * 100))
        components += 1
    if components > 0:
        value = score_acc / components

    # --- Growth (0-100, revenue + earnings growth) ---
    growth = 50.0
    rg = _safe(ratios.get("revenueGrowth"))
    eg = _safe(ratios.get("earningsGrowth"))
    g_comps = 0
    g_acc = 0.0
    if rg is not None:
        # %30 → 100, %0 → 30, %-10 → 0
        g_acc += max(0, min(100, 30 + rg * 233))
        g_comps += 1
    if eg is not None:
        g_acc += max(0, min(100, 30 + eg * 233))
        g_comps += 1
    if g_comps > 0:
        growth = g_acc / g_comps

    # --- Yield (0-100, dividend + payout sustainability) ---
    yield_score = 50.0
    dy = _safe(ratios.get("dividendYield"))
    payout = _safe(ratios.get("payoutRatio"))
    if dy is not None:
        # %0 → 0, %3 → 50, %6+ → 100
        yield_score = min(100, dy * 1667)
        # payout > 100% ise sürdürülebilir değil — ceza
        if payout is not None and payout > 1:
            yield_score *= 0.5
    else:
        yield_score = 30  # temettüsüz, neutral-low

    composite = (quality * 0.4 + value * 0.3 + growth * 0.2 + yield_score * 0.1)
    composite = round(max(0, min(100, composite)), 1)

    if composite >= 75:
        verdict = "Çok Cazip"
        verdict_color = "up"
    elif composite >= 60:
        verdict = "Cazip"
        verdict_color = "up"
    elif composite >= 45:
        verdict = "Tut"
        verdict_color = "warn"
    elif composite >= 30:
        verdict = "Pahalı"
        verdict_color = "down"
    else:
        verdict = "Kaçın"
        verdict_color = "down"

    result = {
        "ticker": ticker,
        "score": composite,
        "verdict": verdict,
        "verdictColor": verdict_color,
        "breakdown": {
            "quality": round(quality, 1),
            "value": round(value, 1),
            "growth": round(growth, 1),
            "yield": round(yield_score, 1),
        },
        "weights": {"quality": 0.4, "value": 0.3, "growth": 0.2, "yield": 0.1},
    }
    cache.set(cache_key, result, ttl=3600)
    return result
