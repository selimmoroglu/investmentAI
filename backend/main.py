from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import stocks, quote, history, financials, technicals, sectors

app = FastAPI(title="InvestmentAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(stocks.router, prefix="/api")
app.include_router(quote.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(financials.router, prefix="/api")
app.include_router(technicals.router, prefix="/api")
app.include_router(sectors.router, prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "message": "InvestmentAI API"}
