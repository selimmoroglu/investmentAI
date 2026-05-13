"""Quality & Risk skorları — Piotroski + Altman."""
from fastapi import APIRouter, HTTPException
from ..services.quality_scores import piotroski_f_score, altman_z_score

router = APIRouter()


@router.get("/quality/{ticker:path}")
def get_quality(ticker: str):
    """Bir hisse için Piotroski F-Score + Altman Z-Score kombine sonuç."""
    pio = piotroski_f_score(ticker)
    alt = altman_z_score(ticker)
    if pio is None and alt is None:
        raise HTTPException(status_code=404, detail=f"Kalite skorları hesaplanamadı: {ticker}")

    # Composite long-term verdict
    long_term_verdict = "Yetersiz Veri"
    long_term_color = "neutral"
    if pio and alt:
        if pio["score"] >= 7 and alt["zone"] == "Güvenli":
            long_term_verdict = "Uzun Vade İçin Güçlü"
            long_term_color = "up"
        elif pio["score"] >= 5 and alt["zone"] != "Riskli":
            long_term_verdict = "Uzun Vade İçin İyi"
            long_term_color = "up"
        elif pio["score"] <= 3 or alt["zone"] == "Riskli":
            long_term_verdict = "Risk Var"
            long_term_color = "down"
        else:
            long_term_verdict = "Dikkatli"
            long_term_color = "warn"
    elif pio:
        if pio["score"] >= 7: long_term_verdict, long_term_color = "Uzun Vade İçin Güçlü", "up"
        elif pio["score"] >= 5: long_term_verdict, long_term_color = "Uzun Vade İçin İyi", "up"
        elif pio["score"] <= 3: long_term_verdict, long_term_color = "Zayıf Kalite", "down"
        else: long_term_verdict, long_term_color = "Dikkatli", "warn"
    elif alt:
        long_term_verdict = "İflas Riski " + alt["zone"]
        long_term_color = alt["zoneColor"]

    return {
        "ticker": ticker,
        "piotroski": pio,
        "altman": alt,
        "longTermVerdict": long_term_verdict,
        "longTermColor": long_term_color,
    }
