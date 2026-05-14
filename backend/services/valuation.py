"""DCF (Discounted Cash Flow) + Composite 'Uzun Vade Skoru'.

DCF: 5 yıllık projected FCF + terminal value, WACC ile iskonto.
Composite: Quality + Value + Growth + Yield → 0-100 skor.

Önemli:
- TL bazlı hisseler (.IS) için varsayılan iskonto oranı %20 (enflasyon + risk primi).
  Türkiye için uygun WACC = risksiz oran (~18%) + hisse senedi risk primi
- Finansal şirketler (banka, sigorta) için FCF güvenilmez.
  Bunun yerine net kâr tabanlı değerleme kullanılır (Kazanç Gücü Değeri).
"""
from typing import Optional
import yfinance as yf
from .cache import cache
from .yfinance_service import get_quote, get_ratios
from .quality_scores import piotroski_f_score, altman_z_score, _is_financial_company, _row_values, _to_float, _at


def _safe(v) -> Optional[float]:
    try:
        if v is None:
            return None
        import math
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _is_tr_ticker(ticker: str) -> bool:
    return ticker.upper().endswith(".IS")


# --- DCF ---

def dcf_intrinsic_value(
    ticker: str,
    growth_5y: float = 0.10,
    terminal_growth: float = 0.025,
    discount_rate: float = 0.10,
) -> Optional[dict]:
    """DCF adil değer hesabı.

    - Endüstriyel şirket: FCF tabanlı (standart)
    - Finansal şirket: FCF güvenilmez → Net Kâr * 0.65 (Kazanç Gücü Değeri)
    - TL hissesi: Varsayılan iskonto oranı API'de %20 olarak geçirilir (frontend default)

    Formül:
    Year 1-5: FCF_0 * (1+g)^i
    PV: future_fcf / (1+d)^i
    Terminal: fcf_5 * (1+tg) / (d - tg), iskonto edilmiş
    Fair Value = (sum_PV + PV_terminal - net_debt) / shares
    """
    quote = get_quote(ticker)
    if not quote:
        return None

    current_price = _safe(quote.get("currentPrice"))

    # Finansal şirket tespiti
    try:
        t_info = yf.Ticker(ticker).info or {}
    except Exception:
        t_info = {}

    is_financial = _is_financial_company(ticker, t_info)

    # FCF hesabı
    fcf = None
    valuation_method = "fcf_dcf"

    if not is_financial:
        # Standart: FCF = OperatingCF - CapEx
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
    else:
        # Finansal şirket: FCF güvenilmez, net kâr kullan
        valuation_method = "earnings_dcf"
        net_income = _safe(quote.get("freeCashflow"))  # yfinance info'da bazen NI burada da gelir

        # Financials'tan net income çek (daha güvenilir)
        try:
            t = yf.Ticker(ticker)
            inc = t.financials
            if inc is not None and not inc.empty:
                ni_row = _at(_row_values(inc, ["Net Income", "Net Income Common Stockholders"]), 0)
                if ni_row is not None and ni_row > 0:
                    net_income = ni_row
        except Exception:
            pass

        if net_income is None or net_income <= 0:
            # Son çare: freeCashflow'u al ama güvenilirlik uyarısı ver
            fcf_raw = _safe(quote.get("freeCashflow"))
            if fcf_raw is not None and fcf_raw > 0:
                net_income = fcf_raw

        if net_income is not None and net_income > 0:
            # Bankalar için sürdürülebilir kâr = net kâr * 0.65
            # (sermaye ihtiyacı için ~35% kâr içerde kalmalı)
            fcf = net_income * 0.65
        else:
            fcf = None

    if fcf is None or fcf <= 0:
        return {
            "error": "FCF negatif veya hesaplanamıyor — DCF uygulanamaz.",
            "fairValuePerShare": None,
            "currentPrice": current_price,
            "upsidePct": None,
            "valuationMethod": valuation_method,
        }

    shares = _safe(quote.get("sharesOutstanding"))
    total_debt = _safe(quote.get("totalDebt")) or 0
    total_cash = _safe(quote.get("totalCash")) or 0
    net_debt = total_debt - total_cash

    if not shares or shares <= 0:
        return {
            "error": "Hisse sayısı bulunamadı",
            "fairValuePerShare": None,
            "currentPrice": current_price,
            "upsidePct": None,
            "valuationMethod": valuation_method,
        }

    if discount_rate <= terminal_growth:
        return {
            "error": "İskonto oranı terminal büyümeden büyük olmalı",
            "fairValuePerShare": None,
            "currentPrice": current_price,
            "upsidePct": None,
            "valuationMethod": valuation_method,
        }

    # 5-yıl FCF projeksiyon + PV
    pv_sum = 0.0
    yearly = []
    fcf_n = fcf
    for year in range(1, 6):
        fcf_n = fcf_n * (1 + growth_5y)
        pv = fcf_n / ((1 + discount_rate) ** year)
        pv_sum += pv
        yearly.append({"year": year, "fcf": round(fcf_n, 2), "pv": round(pv, 2)})

    terminal_value = fcf_n * (1 + terminal_growth) / (discount_rate - terminal_growth)
    pv_terminal = terminal_value / ((1 + discount_rate) ** 5)

    enterprise_value = pv_sum + pv_terminal
    equity_value = enterprise_value - net_debt
    fair_value_per_share = equity_value / shares

    upside_pct = None
    if current_price and current_price > 0:
        upside_pct = ((fair_value_per_share - current_price) / current_price) * 100

    # Sensitivity table
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
            row["values"].append({
                "discountDelta": dd,
                "fairValue": round(fv_s, 2),
                "upsidePct": round(up_s, 2) if up_s is not None else None,
            })
        sensitivity.append(row)

    method_note = {
        "fcf_dcf": "5 yıllık projected FCF + Gordon terminal value, WACC ile bugüne iskonto.",
        "earnings_dcf": (
            "Finansal şirket — FCF yerine net kâr × 0.65 kullanıldı "
            "(sermaye ihtiyacı düşüldükten sonra dağıtılabilir kâr tahmini). "
            "Varsayılan WACC değerini hissenin risk profiline göre ayarlayın."
        ),
    }

    return {
        "currentPrice": current_price,
        "fairValuePerShare": round(fair_value_per_share, 2),
        "upsidePct": round(upside_pct, 2) if upside_pct is not None else None,
        "currency": quote.get("currency"),
        "valuationMethod": valuation_method,
        "methodNote": method_note.get(valuation_method, ""),
        "isFinancial": is_financial,
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
    """Quality + Value + Growth + Yield → 0-100 composite skor.

    Ağırlıklar:
    - Quality 40%: Piotroski (karlılık, kaldıraç, verimlilik) + Altman güvenlik bölgesi + marjlar
    - Value 30%: P/E + P/B + EV/EBITDA + FCF Yield
    - Growth 20%: Gelir büyümesi + Kâr büyümesi + FCF büyümesi
    - Yield 10%: Temettü verimi + sürdürülebilirliği
    """
    cache_key = f"composite2:{ticker}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    ratios = get_ratios(ticker) or {}
    quote = get_quote(ticker) or {}
    pio = piotroski_f_score(ticker)
    alt = altman_z_score(ticker)

    if not ratios and not pio:
        return None

    is_financial = (pio or {}).get("isFinancial", False) or (alt or {}).get("modelType") == "not_applicable"

    # --- Quality (0-100) ---
    quality = 50.0
    if pio:
        valid = pio.get("maxScore", 9)
        quality = (pio["score"] / max(valid, 1)) * 70
    if alt:
        if alt.get("modelType") == "not_applicable":
            # Finansal şirket: sermaye oranına göre kalite puanı
            cap_color = alt.get("zoneColor", "neutral")
            if cap_color == "up":
                quality += 20
            elif cap_color == "warn":
                quality += 12
            elif cap_color == "down":
                quality -= 5
        else:
            if alt["zone"] == "Güvenli":
                quality += 20
            elif alt["zone"] == "Gri":
                quality += 8
            else:
                quality -= 10

    nm = _safe(ratios.get("netMargin"))
    gm = _safe(ratios.get("grossMargin"))
    om = _safe(ratios.get("operatingMargin"))
    if nm is not None:
        if nm > 0.20: quality += 8
        elif nm > 0.10: quality += 5
        elif nm > 0.03: quality += 2
        elif nm < 0: quality -= 15
    if gm is not None and gm > 0.40: quality += 4
    if om is not None and om > 0.15: quality += 3
    quality = max(0, min(100, quality))

    # --- Value (0-100) ---
    value = 50.0
    pe = _safe(ratios.get("pe"))
    pb = _safe(ratios.get("pb"))
    ev_eb = _safe(ratios.get("evEbitda"))
    ps = _safe(ratios.get("ps"))
    peg = _safe(ratios.get("peg"))
    fcf_yield = None
    fcf = _safe(quote.get("freeCashflow"))
    mcap = _safe(quote.get("marketCap"))
    if fcf is not None and mcap and mcap > 0:
        fcf_yield = fcf / mcap

    v_parts = []

    if pe is not None and 0 < pe < 200:
        # P/E: 5→100, 15→80, 25→55, 40→20, 60→0
        if is_financial:
            # Bankalar için P/E ağırlığı daha yüksek (EV/EBITDA anlamsız)
            v_parts.append(max(0, min(100, 100 - ((pe - 5) / 35) * 100)) * 1.5)
        else:
            v_parts.append(max(0, min(100, 100 - ((pe - 5) / 35) * 100)))

    if pb is not None and pb > 0:
        if is_financial:
            # Bankalar için P/B kritik: <1 çok ucuz, 1-2 ucuz, 2-3 makul, >3 pahalı
            v_parts.append(max(0, min(100, 100 - ((pb - 0.3) / 3) * 100)) * 1.5)
        else:
            v_parts.append(max(0, min(100, 100 - ((pb - 0.5) / 5) * 100)))

    if ev_eb is not None and ev_eb > 0 and not is_financial:
        v_parts.append(max(0, min(100, 100 - ((ev_eb - 5) / 25) * 100)))

    if ps is not None and ps > 0 and not is_financial:
        v_parts.append(max(0, min(100, 100 - ((ps - 1) / 15) * 100)))

    if peg is not None and peg > 0:
        # PEG: <1 harika, 1-2 makul, >3 pahalı
        v_parts.append(max(0, min(100, 100 - ((peg - 0.5) / 2.5) * 100)))

    if fcf_yield is not None and fcf_yield > 0:
        # FCF Yield: %2→40, %5→75, %10→100
        v_parts.append(max(0, min(100, fcf_yield * 1000)))

    if v_parts:
        value = sum(v_parts) / len(v_parts)
    else:
        value = 50.0
    value = max(0, min(100, value))

    # --- Growth (0-100) ---
    growth = 50.0
    rg = _safe(ratios.get("revenueGrowth"))
    eg = _safe(ratios.get("earningsGrowth"))
    eqg = _safe(ratios.get("earningsQuarterlyGrowth"))
    g_parts = []
    if rg is not None:
        # %-10→0, %0→30, %15→65, %30→100
        g_parts.append(max(0, min(100, 30 + rg * 233)))
    if eg is not None:
        g_parts.append(max(0, min(100, 30 + eg * 200)))
    if eqg is not None:
        g_parts.append(max(0, min(100, 30 + eqg * 180)) * 0.5)  # çeyreklik daha az ağırlık
    if g_parts:
        total_w = len(g_parts) - (0.5 if eqg is not None else 0)
        growth = sum(g_parts) / max(total_w, 1)
    growth = max(0, min(100, growth))

    # --- Yield (0-100) ---
    yield_score = 30.0  # temettüsüz için düşük-nötr
    dy = _safe(ratios.get("dividendYield"))
    payout = _safe(ratios.get("payoutRatio"))
    if dy is not None and dy > 0:
        # %0.5→20, %2→55, %4→80, %6→100
        yield_score = min(100, dy * 1500)
        if payout is not None:
            if payout > 1.0:
                yield_score *= 0.4  # sürdürülemez temettü
            elif payout > 0.85:
                yield_score *= 0.75
            elif payout < 0.30:
                yield_score *= 0.85  # çok düşük ödeme, büyüme şirketi
    yield_score = max(0, min(100, yield_score))

    # --- Composite ---
    composite = (quality * 0.40 + value * 0.30 + growth * 0.20 + yield_score * 0.10)
    composite = round(max(0, min(100, composite)), 1)

    if composite >= 75:
        verdict, verdict_color = "Çok Cazip", "up"
    elif composite >= 60:
        verdict, verdict_color = "Cazip", "up"
    elif composite >= 45:
        verdict, verdict_color = "Tut", "warn"
    elif composite >= 30:
        verdict, verdict_color = "Pahalı", "down"
    else:
        verdict, verdict_color = "Kaçın", "down"

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
        "isFinancial": is_financial,
    }
    cache.set(cache_key, result, ttl=3600)
    return result
