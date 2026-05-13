"""DCF + Composite Uzun Vade Skoru endpoints."""
from fastapi import APIRouter, HTTPException, Query
from ..services.valuation import dcf_intrinsic_value, composite_long_term_score

router = APIRouter()


@router.get("/dcf/{ticker:path}")
def get_dcf(
    ticker: str,
    growth_5y: float = Query(0.10, ge=-0.20, le=0.50, description="Yıllık FCF büyüme tahmini (decimal, örn 0.10=%10)"),
    terminal_growth: float = Query(0.025, ge=-0.05, le=0.10, description="Sonsuza dek terminal büyüme"),
    discount_rate: float = Query(0.10, ge=0.03, le=0.30, description="İskonto/WACC oranı"),
):
    result = dcf_intrinsic_value(ticker, growth_5y, terminal_growth, discount_rate)
    if result is None:
        raise HTTPException(status_code=404, detail=f"DCF hesaplanamadı: {ticker}")
    return result


@router.get("/composite/{ticker:path}")
def get_composite(ticker: str):
    result = composite_long_term_score(ticker)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Composite skor hesaplanamadı: {ticker}")
    return result
