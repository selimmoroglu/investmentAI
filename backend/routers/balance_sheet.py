"""GET /api/balance-sheet/{ticker} — bilanço trend analizi + uzun vade yorumu."""
from fastapi import APIRouter
from ..services.balance_sheet_analysis import analyze_balance_sheet

router = APIRouter()


@router.get("/balance-sheet/{ticker}")
def get_balance_sheet_analysis(ticker: str):
    result = analyze_balance_sheet(ticker.upper())
    if result is None:
        return {"error": "Veri alınamadı veya finansal tablolar boş."}
    return result
