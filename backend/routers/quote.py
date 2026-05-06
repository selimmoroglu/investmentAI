from fastapi import APIRouter, HTTPException
from ..services.yfinance_service import get_quote

router = APIRouter()


@router.get("/quote/{ticker}")
def quote(ticker: str):
    data = get_quote(ticker.upper())
    if data is None:
        raise HTTPException(status_code=404, detail=f"Ticker not found: {ticker}")
    return data
