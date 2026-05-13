"""Piotroski F-Score (0-9) + Altman Z-Score — uzun vadeli kalite & risk analizi."""
from typing import Optional
import yfinance as yf
from .cache import cache


# --- yardımcılar ---

def _row_values(df, candidates: list[str]) -> Optional[list[float]]:
    """Bir income/balance/cashflow df'inde verilen label'lardan ilk bulunanın değerlerini döner.
    Most-recent-first sıralı."""
    if df is None or df.empty:
        return None
    idx_lc = [str(i).lower() for i in df.index]
    for cand in candidates:
        cl = cand.lower()
        # tam eşleşme
        for i, lbl in enumerate(idx_lc):
            if lbl == cl:
                return [_to_float(v) for v in df.iloc[i].values]
        # partial
        for i, lbl in enumerate(idx_lc):
            if cl in lbl:
                return [_to_float(v) for v in df.iloc[i].values]
    return None


def _to_float(v) -> Optional[float]:
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


def _at(values: Optional[list[float]], idx: int) -> Optional[float]:
    if not values or idx >= len(values) or idx < 0:
        return None
    return values[idx]


# --- Piotroski F-Score (0-9) ---

PIOTROSKI_CRITERIA = [
    {"key": "roa_positive", "label": "ROA pozitif (son yıl)", "category": "profitability"},
    {"key": "ocf_positive", "label": "Operasyonel nakit akışı pozitif", "category": "profitability"},
    {"key": "roa_increasing", "label": "ROA bir önceki yıla göre artıyor", "category": "profitability"},
    {"key": "ocf_above_ni", "label": "OCF, Net Kar'ın üstünde (kaliteli kar)", "category": "profitability"},
    {"key": "lt_debt_decreasing", "label": "Uzun vadeli borç azalıyor", "category": "leverage"},
    {"key": "current_ratio_increasing", "label": "Cari oran artıyor", "category": "leverage"},
    {"key": "shares_not_increasing", "label": "Hisse sayısı artmıyor (dilution yok)", "category": "leverage"},
    {"key": "gross_margin_increasing", "label": "Brüt marj artıyor", "category": "efficiency"},
    {"key": "asset_turnover_increasing", "label": "Aktif devir hızı artıyor", "category": "efficiency"},
]


def piotroski_f_score(ticker: str) -> Optional[dict]:
    key = f"piotroski:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        inc = t.financials                # most-recent-first
        bal = t.balance_sheet
        cf = t.cashflow
    except Exception:
        return None

    if inc is None or bal is None or inc.empty or bal.empty:
        return None

    # Veri çekme (most-recent-first; idx 0 = son yıl, idx 1 = önceki yıl)
    net_income = _row_values(inc, ["Net Income", "Net Income Common Stockholders", "Net Income From Continuing Operation Net Minority Interest"])
    total_assets = _row_values(bal, ["Total Assets"])
    ocf = _row_values(cf, ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"])
    lt_debt = _row_values(bal, ["Long Term Debt", "Long Term Debt And Capital Lease Obligation"])
    current_assets = _row_values(bal, ["Current Assets", "Total Current Assets"])
    current_liab = _row_values(bal, ["Current Liabilities", "Total Current Liabilities"])
    shares = _row_values(inc, ["Diluted Average Shares", "Basic Average Shares"])
    revenue = _row_values(inc, ["Total Revenue", "Operating Revenue", "Revenue"])
    gross_profit = _row_values(inc, ["Gross Profit"])

    # Önceki yıl ortalama varlık için idx 1 ve idx 2 lazım; bazı şirketlerde sadece 2 yıl olabilir
    breakdown = []
    score = 0

    def check(passed: Optional[bool], key: str) -> int:
        meta = next((c for c in PIOTROSKI_CRITERIA if c["key"] == key), None)
        if passed is None:
            breakdown.append({**(meta or {}), "passed": None, "skipped": True})
            return 0
        breakdown.append({**(meta or {}), "passed": bool(passed), "skipped": False})
        return 1 if passed else 0

    # 1. ROA pozitif
    ni0 = _at(net_income, 0); ta0 = _at(total_assets, 0); ta1 = _at(total_assets, 1)
    avg_ta_curr = (ta0 + ta1) / 2 if ta0 is not None and ta1 is not None else ta0
    roa_curr = (ni0 / avg_ta_curr) if (ni0 is not None and avg_ta_curr) else None
    score += check(roa_curr is not None and roa_curr > 0, "roa_positive")

    # 2. OCF pozitif
    ocf0 = _at(ocf, 0)
    score += check(ocf0 is not None and ocf0 > 0, "ocf_positive")

    # 3. ROA artıyor (son yıl > önceki yıl)
    ni1 = _at(net_income, 1); ta2 = _at(total_assets, 2)
    avg_ta_prev = (ta1 + ta2) / 2 if ta1 is not None and ta2 is not None else ta1
    roa_prev = (ni1 / avg_ta_prev) if (ni1 is not None and avg_ta_prev) else None
    score += check(roa_curr is not None and roa_prev is not None and roa_curr > roa_prev, "roa_increasing")

    # 4. OCF > Net Income (kaliteli kar)
    score += check(ocf0 is not None and ni0 is not None and ocf0 > ni0, "ocf_above_ni")

    # 5. LT Debt azalıyor (oran olarak, TA'ya göre)
    lt0 = _at(lt_debt, 0); lt1 = _at(lt_debt, 1)
    if lt0 is not None and lt1 is not None and ta0 and ta1:
        ratio_curr = lt0 / ta0
        ratio_prev = lt1 / ta1
        score += check(ratio_curr < ratio_prev, "lt_debt_decreasing")
    else:
        score += check(None, "lt_debt_decreasing")

    # 6. Cari oran artıyor
    ca0 = _at(current_assets, 0); cl0 = _at(current_liab, 0)
    ca1 = _at(current_assets, 1); cl1 = _at(current_liab, 1)
    cr_curr = (ca0 / cl0) if (ca0 is not None and cl0) else None
    cr_prev = (ca1 / cl1) if (ca1 is not None and cl1) else None
    score += check(cr_curr is not None and cr_prev is not None and cr_curr > cr_prev, "current_ratio_increasing")

    # 7. Hisse sayısı artmıyor
    sh0 = _at(shares, 0); sh1 = _at(shares, 1)
    score += check(sh0 is not None and sh1 is not None and sh0 <= sh1 * 1.01, "shares_not_increasing")

    # 8. Brüt marj artıyor
    gp0 = _at(gross_profit, 0); rev0 = _at(revenue, 0)
    gp1 = _at(gross_profit, 1); rev1 = _at(revenue, 1)
    gm_curr = (gp0 / rev0) if (gp0 is not None and rev0) else None
    gm_prev = (gp1 / rev1) if (gp1 is not None and rev1) else None
    score += check(gm_curr is not None and gm_prev is not None and gm_curr > gm_prev, "gross_margin_increasing")

    # 9. Aktif devir hızı artıyor
    at_curr = (rev0 / avg_ta_curr) if (rev0 is not None and avg_ta_curr) else None
    at_prev = (rev1 / avg_ta_prev) if (rev1 is not None and avg_ta_prev) else None
    score += check(at_curr is not None and at_prev is not None and at_curr > at_prev, "asset_turnover_increasing")

    # Doluluk: kaç kriter atlanmadı
    valid_count = sum(1 for b in breakdown if not b.get("skipped"))

    if score >= 7:
        verdict = "Güçlü"
        verdict_color = "up"
    elif score >= 5:
        verdict = "İyi"
        verdict_color = "up"
    elif score >= 3:
        verdict = "Orta"
        verdict_color = "warn"
    else:
        verdict = "Zayıf"
        verdict_color = "down"

    result = {
        "score": score,
        "maxScore": valid_count if valid_count > 0 else 9,
        "totalCriteria": 9,
        "verdict": verdict,
        "verdictColor": verdict_color,
        "breakdown": breakdown,
    }
    cache.set(key, result, ttl=3600)
    return result


# --- Altman Z-Score ---

def altman_z_score(ticker: str) -> Optional[dict]:
    key = f"altman:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        inc = t.financials
        bal = t.balance_sheet
        info = t.info or {}
    except Exception:
        return None

    if inc is None or bal is None or inc.empty or bal.empty:
        return None

    total_assets = _at(_row_values(bal, ["Total Assets"]), 0)
    if not total_assets or total_assets <= 0:
        return None

    current_assets = _at(_row_values(bal, ["Current Assets", "Total Current Assets"]), 0)
    current_liab = _at(_row_values(bal, ["Current Liabilities", "Total Current Liabilities"]), 0)
    retained_earnings = _at(_row_values(bal, ["Retained Earnings"]), 0)
    ebit = _at(_row_values(inc, ["EBIT", "Operating Income", "Total Operating Income As Reported"]), 0)
    revenue = _at(_row_values(inc, ["Total Revenue", "Operating Revenue", "Revenue"]), 0)
    total_liab = _at(_row_values(bal, ["Total Liabilities Net Minority Interest", "Total Liabilities"]), 0)

    # Market value of equity (Altman'ın orijinali bunu kullanır; kitap değeri fallback)
    market_cap = _to_float(info.get("marketCap"))
    equity_value = market_cap or _at(_row_values(bal, ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"]), 0)

    if not total_liab or total_liab <= 0:
        return None

    # 5 oran
    wc = (current_assets - current_liab) if (current_assets is not None and current_liab is not None) else None
    a = (wc / total_assets) if wc is not None else None
    b = (retained_earnings / total_assets) if retained_earnings is not None else None
    c = (ebit / total_assets) if ebit is not None else None
    d = (equity_value / total_liab) if equity_value is not None else None
    e = (revenue / total_assets) if revenue is not None else None

    parts = [
        {"key": "wc_ta", "label": "İşletme Sermayesi / Toplam Varlık", "value": a, "coef": 1.2, "weighted": (1.2 * a if a is not None else None)},
        {"key": "re_ta", "label": "Birikmiş Karlar / Toplam Varlık", "value": b, "coef": 1.4, "weighted": (1.4 * b if b is not None else None)},
        {"key": "ebit_ta", "label": "FVÖK / Toplam Varlık", "value": c, "coef": 3.3, "weighted": (3.3 * c if c is not None else None)},
        {"key": "mv_tl", "label": "Özsermaye PD / Toplam Borç", "value": d, "coef": 0.6, "weighted": (0.6 * d if d is not None else None)},
        {"key": "sales_ta", "label": "Satış / Toplam Varlık", "value": e, "coef": 1.0, "weighted": (1.0 * e if e is not None else None)},
    ]

    weighted_sum = [p["weighted"] for p in parts if p["weighted"] is not None]
    if len(weighted_sum) < 3:
        return None  # yetersiz veri
    z = sum(weighted_sum)

    if z > 2.99:
        zone = "Güvenli"
        zone_color = "up"
        zone_desc = "Düşük iflas riski, finansal olarak sağlam."
    elif z >= 1.81:
        zone = "Gri"
        zone_color = "warn"
        zone_desc = "Belirsiz bölge — dikkatli takip gerekli."
    else:
        zone = "Riskli"
        zone_color = "down"
        zone_desc = "Yüksek iflas/finansal stres riski."

    result = {
        "score": round(z, 2),
        "zone": zone,
        "zoneColor": zone_color,
        "zoneDescription": zone_desc,
        "breakdown": [
            {**p, "value": round(p["value"], 4) if p["value"] is not None else None,
                  "weighted": round(p["weighted"], 4) if p["weighted"] is not None else None}
            for p in parts
        ],
    }
    cache.set(key, result, ttl=3600)
    return result
