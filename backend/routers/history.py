from fastapi import APIRouter, HTTPException, Query
from ..services.yfinance_service import get_history

router = APIRouter()

VALID_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"}
VALID_INTERVALS = {"1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"}


@router.get("/history/{ticker}")
def history(
    ticker: str,
    period: str = Query("6mo", pattern="^(1d|5d|1mo|3mo|6mo|1y|2y|5y)$"),
    interval: str = Query("1d", pattern="^(1m|5m|15m|30m|1h|1d|1wk|1mo)$"),
):
    data = get_history(ticker.upper(), period=period, interval=interval)
    if data is None:
        raise HTTPException(status_code=404, detail=f"History not found: {ticker}")
    return data
