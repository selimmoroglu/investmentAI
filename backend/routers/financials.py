from fastapi import APIRouter, HTTPException, Query
from ..services.yfinance_service import get_financials

router = APIRouter()


@router.get("/financials/{ticker}")
def financials(
    ticker: str,
    statement: str = Query("income", pattern="^(income|balance|cashflow)$"),
    freq: str = Query("annual", pattern="^(annual|quarterly)$"),
):
    data = get_financials(ticker.upper(), statement=statement, freq=freq)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Financials not found: {ticker}")
    return data
