from fastapi import APIRouter, HTTPException
from ..services.yfinance_service import get_technicals

router = APIRouter()


@router.get("/technicals/{ticker}")
def technicals(ticker: str):
    data = get_technicals(ticker.upper())
    if data is None:
        raise HTTPException(status_code=404, detail=f"Technical data not found: {ticker}")
    return data
