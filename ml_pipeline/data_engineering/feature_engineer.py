"""
Aurum AI - Feature Engineering & Signal Generation Pipeline
Transforms raw multi-asset prices into institutional-grade feature matrices.
Ensures zero forward-looking leakage (all features computed using past data t <= T).
"""

import sys
import logging
from pathlib import Path
import pandas as pd
import numpy as np

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("feature_engineer")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def compute_rsi(series: pd.Series, window: int = 14) -> pd.Series:
    """Computes Relative Strength Index using Wilder's smoothing."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def generate_feature_matrix(df: pd.DataFrame = None) -> pd.DataFrame:
    """
    Computes technical, macroeconomic, and cross-asset features.
    """
    if df is None:
        raw_path = DATA_DIR / "multi_asset_cleaned.csv"
        if not raw_path.exists():
            from ml_pipeline.data_engineering.multi_asset_miner import fetch_multi_asset_history
            df = fetch_multi_asset_history()
        else:
            df = pd.read_csv(raw_path, index_col="date", parse_dates=True)

    logger.info("Generating feature matrix from %d rows of cleaned data...", len(df))
    feat = pd.DataFrame(index=df.index)

    # 1. Domestic Landed INR Estimates (Duty: 15%, GST: 3%)
    troy_ounce = 31.1034768
    duty_gst_multiplier = 1.18
    
    landed_gold = (df["gold_close"] / troy_ounce * 10.0) * df["usdinr_close"] * duty_gst_multiplier
    landed_silver = (df["silver_close"] / troy_ounce * 10.0) * df["usdinr_close"] * duty_gst_multiplier
    feat["landed_gold_24k"] = landed_gold
    feat["landed_silver_10g"] = landed_silver

    # 2. Moving Averages & Moving Average Ratios (Core Descriptives)
    for w in [7, 15, 30, 50, 200]:
        feat[f"ma_{w}"] = landed_gold.rolling(window=w).mean()
        feat[f"price_to_ma_{w}"] = landed_gold / feat[f"ma_{w}"]

    # Golden Cross Flag (MA50 > MA200)
    feat["golden_cross"] = (feat["ma_50"] > feat["ma_200"]).astype(int)

    # 3. Trailing Returns & Momentum
    for lag in [1, 3, 5, 10, 15, 30]:
        feat[f"ret_{lag}d"] = landed_gold.pct_change(lag)

    # 4. Momentum Oscillators (RSI, MACD)
    feat["rsi_14"] = compute_rsi(landed_gold, window=14)
    
    ema12 = landed_gold.ewm(span=12, adjust=False).mean()
    ema26 = landed_gold.ewm(span=26, adjust=False).mean()
    feat["macd_line"] = ema12 - ema26
    feat["macd_signal"] = feat["macd_line"].ewm(span=9, adjust=False).mean()
    feat["macd_hist"] = feat["macd_line"] - feat["macd_signal"]

    # 5. Volatility & Bollinger Bands
    feat["vol_15d"] = feat["ret_1d"].rolling(window=15).std() * np.sqrt(252)
    feat["vol_30d"] = feat["ret_1d"].rolling(window=30).std() * np.sqrt(252)

    # Bollinger Bands (20-day, 2 std)
    sma20 = landed_gold.rolling(window=20).mean()
    std20 = landed_gold.rolling(window=20).std()
    bb_upper = sma20 + (2 * std20)
    bb_lower = sma20 - (2 * std20)
    feat["bb_width"] = (bb_upper - bb_lower) / sma20
    feat["bb_pct_b"] = (landed_gold - bb_lower) / (bb_upper - bb_lower + 1e-9)

    # 6. Cross-Asset Features
    feat["gold_silver_ratio"] = df["gold_close"] / (df["silver_close"] + 1e-9)
    feat["gold_silver_ratio_ma30"] = feat["gold_silver_ratio"].rolling(30).mean()
    
    if "crude_oil_close" in df.columns:
        feat["gold_oil_ratio"] = df["gold_close"] / (df["crude_oil_close"] + 1e-9)
        feat["crude_ret_15d"] = df["crude_oil_close"].pct_change(15)

    if "us_10y_yield_close" in df.columns:
        feat["yield_10y"] = df["us_10y_yield_close"]
        feat["yield_10y_delta_15d"] = df["us_10y_yield_close"].diff(15)

    feat["usdinr_ret_15d"] = df["usdinr_close"].pct_change(15)

    # 7. Supervised Target Variables (Forward-looking, used ONLY for training evaluation)
    feat["target_5d_ret"] = landed_gold.pct_change(5).shift(-5)
    feat["target_5d_dir"] = (feat["target_5d_ret"] > 0).astype(int)
    
    feat["target_15d_ret"] = landed_gold.pct_change(15).shift(-15)
    feat["target_15d_dir"] = (feat["target_15d_ret"] > 0).astype(int)

    # Drop initial rolling window NaNs (200 rows for MA200)
    cleaned_feat = feat.iloc[200:].copy()

    # Save to disk
    out_path = DATA_DIR / "features_matrix.csv"
    cleaned_feat.to_csv(out_path)
    logger.info("Feature matrix generated successfully: %d rows x %d features saved to %s",
                len(cleaned_feat), len(cleaned_feat.columns), out_path)
    return cleaned_feat


if __name__ == "__main__":
    matrix = generate_feature_matrix()
    print("Features Matrix Shape:", matrix.shape)
    print("\nFeature Columns (Total", len(matrix.columns), "):")
    print(list(matrix.columns))
    print("\nTarget 5-Day Up vs Down Distribution:")
    print(matrix["target_5d_dir"].dropna().value_counts(normalize=True))
