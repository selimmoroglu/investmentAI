"""Piotroski F-Score (0-9) + Altman Z-Score — uzun vadeli kalite & risk analizi.

NOT: Altman Z-Score standart modeli banka/sigorta/finansal aracılık şirketleri için
geçerli değildir. Bu şirketler için sermaye yeterliliği ve kârlılık bazlı alternatif
metrikler kullanılır.
"""
import json
import os
from typing import Optional
import yfinance as yf
from .cache import cache


DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# --- Finans sektörü tespiti ---

_SECTOR_MAP: Optional[dict] = None

def _get_sector_map() -> dict:
    global _SECTOR_MAP
    if _SECTOR_MAP is not None:
        return _SECTOR_MAP
    m = {}
    for fname in ["bist_tickers.json", "us_tickers.json"]:
        try:
            with open(os.path.join(DATA_DIR, fname), encoding="utf-8") as f:
                for item in json.load(f):
                    m[item["ticker"].upper()] = item.get("sector", "")
        except Exception:
            pass
    _SECTOR_MAP = m
    return m


FINANCIAL_SECTORS_TR = {"bankacılık", "sigorta", "finansal hizmetler", "finansal", "leasing", "faktoring"}
FINANCIAL_SECTOR_KEYWORDS = {"bank", "insurance", "financ", "leasing", "factoring", "credit", "mortgage", "broker", "invest"}


def _is_financial_company(ticker: str, info: dict) -> bool:
    """Banka, sigorta, finansal aracılık şirketlerini tespit eder."""
    sector_yf = (info.get("sector") or "").lower()
    industry_yf = (info.get("industry") or "").lower()
    for kw in FINANCIAL_SECTOR_KEYWORDS:
        if kw in sector_yf or kw in industry_yf:
            return True
    # Yerel JSON fallback (özellikle BIST hisseleri için)
    local_sector = _get_sector_map().get(ticker.upper(), "").lower()
    for kw in FINANCIAL_SECTORS_TR:
        if kw in local_sector:
            return True
    return False


# --- yardımcılar ---

def _row_values(df, candidates: list[str]) -> Optional[list[float]]:
    """DataFrame'de verilen label'lardan ilk bulunanın değerlerini döner (most-recent-first)."""
    if df is None or df.empty:
        return None
    idx_str = [str(i) for i in df.index]
    idx_lc = [s.lower() for s in idx_str]
    for cand in candidates:
        cl = cand.lower()
        for i, lbl in enumerate(idx_lc):
            if lbl == cl:
                return [_to_float(v) for v in df.iloc[i].values]
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
        return None if (math.isnan(f) or math.isinf(f)) else f
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
    {"key": "ocf_above_ni", "label": "OCF, Net Kar'ın üstünde (kaliteli kâr)", "category": "profitability"},
    {"key": "lt_debt_decreasing", "label": "Uzun vadeli borç/varlık oranı azalıyor", "category": "leverage"},
    {"key": "current_ratio_increasing", "label": "Cari oran artıyor", "category": "leverage"},
    {"key": "shares_not_increasing", "label": "Hisse sayısı artmıyor (dilution yok)", "category": "leverage"},
    {"key": "gross_margin_increasing", "label": "Brüt marj artıyor", "category": "efficiency"},
    {"key": "asset_turnover_increasing", "label": "Aktif devir hızı artıyor", "category": "efficiency"},
]


def piotroski_f_score(ticker: str) -> Optional[dict]:
    key = f"piotroski2:{ticker}"
    cached = cache.get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        inc = t.financials
        bal = t.balance_sheet
        cf = t.cashflow
        info = t.info or {}
    except Exception:
        return None

    if inc is None or bal is None or inc.empty or bal.empty:
        return None

    is_financial = _is_financial_company(ticker, info)

    net_income = _row_values(inc, ["Net Income", "Net Income Common Stockholders", "Net Income From Continuing Operation Net Minority Interest"])
    total_assets = _row_values(bal, ["Total Assets"])
    ocf = _row_values(cf, ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"]) if cf is not None and not cf.empty else None
    lt_debt = _row_values(bal, ["Long Term Debt", "Long Term Debt And Capital Lease Obligation"])
    current_assets = _row_values(bal, ["Current Assets", "Total Current Assets"])
    current_liab = _row_values(bal, ["Current Liabilities", "Total Current Liabilities"])
    shares = _row_values(inc, ["Diluted Average Shares", "Basic Average Shares"])
    revenue = _row_values(inc, ["Total Revenue", "Operating Revenue", "Revenue", "Interest Income", "Net Interest Income"])
    gross_profit = _row_values(inc, ["Gross Profit"])

    breakdown = []
    score = 0

    def check(passed: Optional[bool], key: str, skip_for_financial: bool = False) -> int:
        meta = next((c for c in PIOTROSKI_CRITERIA if c["key"] == key), None)
        if is_financial and skip_for_financial:
            breakdown.append({**(meta or {}), "passed": None, "skipped": True})
            return 0
        if passed is None:
            breakdown.append({**(meta or {}), "passed": None, "skipped": True})
            return 0
        breakdown.append({**(meta or {}), "passed": bool(passed), "skipped": False})
        return 1 if passed else 0

    ni0 = _at(net_income, 0); ta0 = _at(total_assets, 0); ta1 = _at(total_assets, 1)
    avg_ta_curr = (ta0 + ta1) / 2 if ta0 is not None and ta1 is not None else ta0
    roa_curr = (ni0 / avg_ta_curr) if (ni0 is not None and avg_ta_curr) else None
    score += check(roa_curr is not None and roa_curr > 0, "roa_positive")

    ocf0 = _at(ocf, 0) if ocf else None
    # Bankalar için OCF güvenilmez (kredi/mevduat hareketleri büyütür) — skip
    score += check(ocf0 is not None and ocf0 > 0, "ocf_positive", skip_for_financial=is_financial)

    ni1 = _at(net_income, 1); ta2 = _at(total_assets, 2)
    avg_ta_prev = (ta1 + ta2) / 2 if ta1 is not None and ta2 is not None else ta1
    roa_prev = (ni1 / avg_ta_prev) if (ni1 is not None and avg_ta_prev) else None
    score += check(roa_curr is not None and roa_prev is not None and roa_curr > roa_prev, "roa_increasing")

    # Bankalar için OCF > Net Income kriteri uygulanamaz
    score += check(ocf0 is not None and ni0 is not None and ocf0 > ni0, "ocf_above_ni", skip_for_financial=is_financial)

    lt0 = _at(lt_debt, 0); lt1 = _at(lt_debt, 1)
    if lt0 is not None and lt1 is not None and ta0 and ta1:
        ratio_curr = lt0 / ta0
        ratio_prev = lt1 / ta1
        score += check(ratio_curr < ratio_prev, "lt_debt_decreasing")
    else:
        score += check(None, "lt_debt_decreasing")

    ca0 = _at(current_assets, 0); cl0 = _at(current_liab, 0)
    ca1 = _at(current_assets, 1); cl1 = _at(current_liab, 1)
    cr_curr = (ca0 / cl0) if (ca0 is not None and cl0) else None
    cr_prev = (ca1 / cl1) if (ca1 is not None and cl1) else None
    # Bankalar için cari oran anlamlı değil
    score += check(cr_curr is not None and cr_prev is not None and cr_curr > cr_prev, "current_ratio_increasing", skip_for_financial=is_financial)

    sh0 = _at(shares, 0); sh1 = _at(shares, 1)
    score += check(sh0 is not None and sh1 is not None and sh0 <= sh1 * 1.01, "shares_not_increasing")

    gp0 = _at(gross_profit, 0); rev0 = _at(revenue, 0)
    gp1 = _at(gross_profit, 1); rev1 = _at(revenue, 1)
    gm_curr = (gp0 / rev0) if (gp0 is not None and rev0) else None
    gm_prev = (gp1 / rev1) if (gp1 is not None and rev1) else None
    # Bankalar için brüt marj kriteri uygulanamaz (net faiz marjı kullanılır)
    score += check(gm_curr is not None and gm_prev is not None and gm_curr > gm_prev, "gross_margin_increasing", skip_for_financial=is_financial)

    at_curr = (rev0 / avg_ta_curr) if (rev0 is not None and avg_ta_curr) else None
    at_prev = (rev1 / avg_ta_prev) if (rev1 is not None and avg_ta_prev) else None
    # Bankalar için aktif devir hızı anlamlı değil (assets çok büyük)
    score += check(at_curr is not None and at_prev is not None and at_curr > at_prev, "asset_turnover_increasing", skip_for_financial=is_financial)

    valid_count = sum(1 for b in breakdown if not b.get("skipped"))
    max_score = max(valid_count, 1)

    if score >= 7 or (valid_count < 7 and score >= valid_count * 0.78):
        verdict, verdict_color = "Güçlü", "up"
    elif score >= 5 or (valid_count < 7 and score >= valid_count * 0.56):
        verdict, verdict_color = "İyi", "up"
    elif score >= 3:
        verdict, verdict_color = "Orta", "warn"
    else:
        verdict, verdict_color = "Zayıf", "down"

    result = {
        "score": score,
        "maxScore": max_score,
        "totalCriteria": 9,
        "verdict": verdict,
        "verdictColor": verdict_color,
        "breakdown": breakdown,
        "isFinancial": is_financial,
    }
    cache.set(key, result, ttl=3600)
    return result


# --- Altman Z-Score ---

def altman_z_score(ticker: str) -> Optional[dict]:
    """Standart Altman Z-Score (endüstriyel şirketler) veya finansal şirket için alternatif metrikler."""
    key = f"altman2:{ticker}"
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

    is_financial = _is_financial_company(ticker, info)

    total_assets = _at(_row_values(bal, ["Total Assets"]), 0)
    if not total_assets or total_assets <= 0:
        return None

    # --- Finansal şirketler: Altman uygulanamaz, alternatif metrikler ---
    if is_financial:
        result = _financial_company_risk(ticker, inc, bal, info, total_assets)
        if result:
            cache.set(key, result, ttl=3600)
        return result

    # --- Endüstriyel şirketler: Standart Altman Z-Score ---
    current_assets = _at(_row_values(bal, ["Current Assets", "Total Current Assets"]), 0)
    current_liab = _at(_row_values(bal, ["Current Liabilities", "Total Current Liabilities"]), 0)
    retained_earnings = _at(_row_values(bal, ["Retained Earnings", "Retained Earnings Deficit"]), 0)
    ebit = _at(_row_values(inc, ["EBIT", "Operating Income", "Total Operating Income As Reported", "Normalized EBITDA"]), 0)
    revenue = _at(_row_values(inc, ["Total Revenue", "Operating Revenue", "Revenue"]), 0)
    total_liab = _at(_row_values(bal, ["Total Liabilities Net Minority Interest", "Total Liabilities"]), 0)

    if not total_liab or total_liab <= 0:
        return None

    # Market value of equity
    market_cap = _to_float(info.get("marketCap"))
    book_equity = _at(_row_values(bal, ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"]), 0)
    equity_value = market_cap or book_equity

    wc = (current_assets - current_liab) if (current_assets is not None and current_liab is not None) else None
    a = (wc / total_assets) if wc is not None else None
    b = (retained_earnings / total_assets) if retained_earnings is not None else None
    c = (ebit / total_assets) if ebit is not None else None
    d = (equity_value / total_liab) if equity_value is not None else None
    e = (revenue / total_assets) if revenue is not None else None

    parts = [
        {"key": "wc_ta",    "label": "İşletme Sermayesi / Toplam Varlık",  "value": a, "coef": 1.2, "weighted": (1.2 * a if a is not None else None)},
        {"key": "re_ta",    "label": "Birikmiş Kârlar / Toplam Varlık",    "value": b, "coef": 1.4, "weighted": (1.4 * b if b is not None else None)},
        {"key": "ebit_ta",  "label": "FVÖK / Toplam Varlık",               "value": c, "coef": 3.3, "weighted": (3.3 * c if c is not None else None)},
        {"key": "mv_tl",    "label": "Özsermaye PD / Toplam Borç",          "value": d, "coef": 0.6, "weighted": (0.6 * d if d is not None else None)},
        {"key": "sales_ta", "label": "Satış / Toplam Varlık",               "value": e, "coef": 1.0, "weighted": (1.0 * e if e is not None else None)},
    ]

    weighted_vals = [p["weighted"] for p in parts if p["weighted"] is not None]
    if len(weighted_vals) < 3:
        return None
    z = sum(weighted_vals)

    if z > 2.99:
        zone, zone_color = "Güvenli", "up"
        zone_desc = "Düşük iflas riski — finansal açıdan sağlam görünüyor."
    elif z >= 1.81:
        zone, zone_color = "Gri", "warn"
        zone_desc = "Belirsiz bölge — dikkatli takip gerekli."
    else:
        zone, zone_color = "Riskli", "down"
        zone_desc = "Yüksek iflas/finansal stres riski işareti."

    result = {
        "score": round(z, 2),
        "zone": zone,
        "zoneColor": zone_color,
        "zoneDescription": zone_desc,
        "modelType": "standard_z",
        "breakdown": [
            {**p,
             "value": round(p["value"], 4) if p["value"] is not None else None,
             "weighted": round(p["weighted"], 4) if p["weighted"] is not None else None}
            for p in parts
        ],
    }
    cache.set(key, result, ttl=3600)
    return result


def _financial_company_risk(ticker: str, inc, bal, info: dict, total_assets: float) -> Optional[dict]:
    """Bankacılık/sigortacılık/finansal şirketler için sermaye & kârlılık risk metrikleri.

    Altman Z-Score bu şirket tipi için geçerli değildir çünkü:
    - Bankalar için WC/TA anlamlı değil (tüm aktifler ve pasifler dönen nitelikte)
    - Satış/TA oranı kasıtlı olarak düşük (bankalar küçük net faiz geliri / büyük aktif)
    - Bunun yerine: Sermaye Yeterliliği + ROA + Kaldıraç kullanılır
    """
    total_liab = _at(_row_values(bal, ["Total Liabilities Net Minority Interest", "Total Liabilities"]), 0)
    book_equity = _at(_row_values(bal, ["Stockholders Equity", "Common Stock Equity", "Total Equity Gross Minority Interest"]), 0)
    net_income = _at(_row_values(inc, ["Net Income", "Net Income Common Stockholders"]), 0)
    retained_earnings = _at(_row_values(bal, ["Retained Earnings"]), 0)

    # Sermaye yeterliliği proxy: Özsermaye / Toplam Varlık (>10% iyi, 8-10% yeterli, <8% düşük)
    capital_ratio = (book_equity / total_assets) if book_equity is not None else None

    # ROA: Net Kâr / Toplam Varlık
    roa = (net_income / total_assets) if net_income is not None else None

    # Kaldıraç: Toplam Yükümlülük / Özsermaye
    leverage = (total_liab / book_equity) if (total_liab is not None and book_equity and book_equity > 0) else None

    # ROE
    roe_info = _to_float(info.get("returnOnEquity"))
    roe = roe_info if roe_info is not None else (
        (net_income / book_equity) if (net_income is not None and book_equity and book_equity > 0) else None
    )

    # Sermaye yeterliliği değerlendirmesi
    if capital_ratio is not None:
        if capital_ratio >= 0.12:
            cap_verdict, cap_color = "Güçlü Sermaye", "up"
        elif capital_ratio >= 0.08:
            cap_verdict, cap_color = "Yeterli Sermaye", "warn"
        else:
            cap_verdict, cap_color = "Zayıf Sermaye", "down"
    else:
        cap_verdict, cap_color = "Veri Yok", "neutral"

    # Genel risk rengi
    if cap_color == "up" and roa is not None and roa > 0.01:
        overall_color = "up"
        overall_desc = "Sermaye yeterliliği güçlü, kârlılık pozitif."
    elif cap_color == "down" or (roa is not None and roa < 0):
        overall_color = "down"
        overall_desc = "Sermaye yeterliliği zayıf veya zarar ediyor."
    else:
        overall_color = "warn"
        overall_desc = "Sermaye yeterliliği yeterli, yakından takip edilmeli."

    metrics = []
    if capital_ratio is not None:
        metrics.append({
            "key": "capital_ratio", "label": "Özsermaye / Toplam Varlık",
            "value": round(capital_ratio * 100, 2), "unit": "%",
            "verdict": cap_verdict, "color": cap_color,
        })
    if roa is not None:
        roa_color = "up" if roa > 0.01 else ("warn" if roa > 0 else "down")
        metrics.append({
            "key": "roa", "label": "Varlık Getirisi (ROA)",
            "value": round(roa * 100, 3), "unit": "%",
            "verdict": "Pozitif" if roa > 0 else "Negatif",
            "color": roa_color,
        })
    if roe is not None:
        roe_color = "up" if roe > 0.12 else ("warn" if roe > 0.05 else "down")
        metrics.append({
            "key": "roe", "label": "Özsermaye Kârlılığı (ROE)",
            "value": round(roe * 100, 2), "unit": "%",
            "verdict": "Güçlü" if roe > 0.15 else ("İyi" if roe > 0.10 else "Zayıf"),
            "color": roe_color,
        })
    if leverage is not None:
        lev_color = "up" if leverage < 10 else ("warn" if leverage < 15 else "down")
        metrics.append({
            "key": "leverage", "label": "Kaldıraç (Borç / Özsermaye)",
            "value": round(leverage, 1), "unit": "x",
            "verdict": "Normal" if leverage < 15 else "Yüksek",
            "color": lev_color,
        })

    return {
        "score": None,
        "zone": "Finans Şirketi",
        "zoneColor": overall_color,
        "zoneDescription": overall_desc,
        "modelType": "not_applicable",
        "notApplicableReason": (
            "Standart Altman Z-Skoru banka, sigorta ve finansal aracılık şirketlerine "
            "uygulanamaz. Bu şirketlerde bilanço yapısı (büyük aktif tabanı, yüksek kaldıraç) "
            "tamamen farklıdır. Bunun yerine sermaye yeterliliği ve kârlılık metrikleri kullanılır."
        ),
        "breakdown": [],
        "alternativeMetrics": metrics,
        "capitalRatio": round(capital_ratio * 100, 2) if capital_ratio is not None else None,
    }
