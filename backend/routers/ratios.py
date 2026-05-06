from fastapi import APIRouter, HTTPException
from ..services.yfinance_service import get_ratios

router = APIRouter()


@router.get("/ratios/{ticker}")
def ratios(ticker: str):
    data = get_ratios(ticker.upper())
    if data is None:
        raise HTTPException(status_code=404, detail=f"Ratios not found: {ticker}")
    return data
