"""
Aurum AI - Quantitative Data Mining & Multi-Asset Pipeline
Pulls multi-year historical quotes for Gold, Silver, USD/INR, Crude Oil, and Macro Yields.
Cleans missing values, aligns multi-exchange calendars, and exports structured dataset.
"""

import os
import sys
import logging
from pathlib import Path
import pandas as pd
import numpy as np

# Defensive UTF-8 encoding for Windows console (RULE-011)
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("multi_asset_miner")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

TICKERS = {
    "gold": "GC=F",
    "silver": "SI=F",
    "usdinr": "INR=X",
    "crude_oil": "CL=F",
    "us_10y_yield": "^TNX"
}


def fetch_multi_asset_history(period: str = "3y") -> pd.DataFrame:
    """
    Pulls historical data for all target tickers and aligns on common trading dates.
    Falls back gracefully to synthetic historical series if network is unavailable.
    """
    logger.info("Fetching multi-asset history for tickers: %s (Period: %s)", list(TICKERS.keys()), period)
    
    dfs = {}
    try:
        import yfinance as yf
        for name, ticker in TICKERS.items():
            try:
                t = yf.Ticker(ticker)
                hist = t.history(period=period)
                if not hist.empty and len(hist) > 50:
                    # Clean index timezone
                    hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                    dfs[f"{name}_close"] = hist["Close"]
                    dfs[f"{name}_high"] = hist["High"]
                    dfs[f"{name}_low"] = hist["Low"]
                    if "Volume" in hist.columns:
                        dfs[f"{name}_volume"] = hist["Volume"]
                    logger.info("Retrieved %d trading days for %s (%s)", len(hist), name, ticker)
            except Exception as e:
                logger.warning("Failed to pull %s (%s): %s", name, ticker, e)

    except ImportError:
        logger.error("yfinance not installed. Please install yfinance.")

    if "gold_close" in dfs and len(dfs["gold_close"]) > 100:
        combined = pd.DataFrame(dfs)
    else:
        logger.warning("Using high-fidelity synthetic historical series for offline / mock testing...")
        combined = generate_synthetic_multi_asset(n_days=756)

    # 1. Forward-fill non-overlapping international market holidays (up to 3 consecutive days)
    combined = combined.ffill(limit=3)
    
    # 2. Backward fill leading NaNs if any asset started later
    combined = combined.bfill()

    # 3. Drop any remaining residual NaNs
    cleaned = combined.dropna().copy()
    cleaned.index.name = "date"

    # Export clean dataset
    out_path = DATA_DIR / "multi_asset_cleaned.csv"
    cleaned.to_csv(out_path)
    logger.info("Successfully cleaned and exported %d rows to %s", len(cleaned), out_path)
    return cleaned


def generate_synthetic_multi_asset(n_days: int = 756) -> pd.DataFrame:
    """
    Generates realistic geometric brownian motion series with empirical correlation structure.
    """
    np.random.seed(42)
    dates = pd.date_range(end=pd.Timestamp.today().normalize(), periods=n_days, freq="B")
    
    # Means and covariance for Gold, Silver, USDINR, Crude, US10Y
    # Typical daily returns parameters
    n_assets = 5
    corr = np.array([
        [1.00, 0.82, 0.35, 0.28, -0.32],
        [0.82, 1.00, 0.29, 0.33, -0.24],
        [0.35, 0.29, 1.00, 0.18, 0.12],
        [0.28, 0.33, 0.18, 1.00, 0.25],
        [-0.32, -0.24, 0.12, 0.25, 1.00]
    ])
    vols = np.array([0.011, 0.018, 0.003, 0.024, 0.022])
    cov = np.outer(vols, vols) * corr
    
    ret = np.random.multivariate_normal(mean=[0.0004, 0.0003, 0.0001, 0.0002, 0.0001], cov=cov, size=n_days)
    
    initial_prices = [2150.0, 24.5, 83.2, 78.0, 4.2]
    prices = initial_prices * np.exp(np.cumsum(ret, axis=0))
    
    df = pd.DataFrame({
        "gold_close": prices[:, 0],
        "gold_high": prices[:, 0] * (1 + np.abs(np.random.normal(0, 0.006, n_days))),
        "gold_low": prices[:, 0] * (1 - np.abs(np.random.normal(0, 0.006, n_days))),
        "silver_close": prices[:, 1],
        "silver_high": prices[:, 1] * (1 + np.abs(np.random.normal(0, 0.009, n_days))),
        "silver_low": prices[:, 1] * (1 - np.abs(np.random.normal(0, 0.009, n_days))),
        "usdinr_close": prices[:, 2],
        "crude_oil_close": prices[:, 3],
        "us_10y_yield_close": prices[:, 4],
    }, index=dates)
    
    return df


if __name__ == "__main__":
    df = fetch_multi_asset_history()
    print("Multi-Asset Data Shape:", df.shape)
    print("Date Range:", df.index.min(), "to", df.index.max())
    print("\nHead:\n", df.head(3))
