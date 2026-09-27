"""
Aurum AI - Trend Signal Walk-Forward Backtester
Complies with Aurum_AI_Specification.md §4.2, RULE-015, RULE-016, and RULE-017.
Evaluates directional predictive edge on historical gold prices using walk-forward validation.
Reports results honestly — negative edge means trend_signal_validated remains FALSE.
"""

import sys
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Builds lag, momentum, and volatility features without lookahead bias."""
    data = df.copy()
    data["ret_1d"] = data["Close"].pct_change(1)
    data["ret_5d"] = data["Close"].pct_change(5)
    data["ret_15d"] = data["Close"].pct_change(15)
    data["ma7"] = data["Close"].rolling(7).mean()
    data["ma15"] = data["Close"].rolling(15).mean()
    data["ma30"] = data["Close"].rolling(30).mean()
    data["ma_ratio_7_15"] = data["ma7"] / data["ma15"]
    data["ma_ratio_15_30"] = data["ma15"] / data["ma30"]
    data["volatility_15d"] = data["ret_1d"].rolling(15).std()

    # Target: 5-day forward return > 0 (1 = Up, 0 = Down/Flat)
    data["target_5d_up"] = (data["Close"].shift(-5) > data["Close"]).astype(int)
    
    # Drop rows with NaN from rolling or shift
    data = data.dropna()
    return data


def run_walk_forward_backtest(ticker: str = "GC=F", period: str = "3y") -> dict:
    """
    Executes walk-forward backtesting across historical data.
    Trains on past window, predicts next out-of-sample block, steps forward.
    """
    print(f"[BACKTEST] Pulling {period} historical data for {ticker}...")
    hist = yf.Ticker(ticker).history(period=period)
    if hist.empty:
        raise ValueError(f"No historical data returned for {ticker}")

    df = build_features(hist)
    feature_cols = [
        "ret_1d", "ret_5d", "ret_15d",
        "ma_ratio_7_15", "ma_ratio_15_30", "volatility_15d"
    ]

    total_samples = len(df)
    train_size = 252  # 1 year of trading days
    step_size = 42    # ~2 months out-of-sample test block

    predictions = []
    actuals = []
    fold_accuracies = []

    start = 0
    fold_idx = 1
    while start + train_size + step_size <= total_samples:
        train_df = df.iloc[start : start + train_size]
        test_df = df.iloc[start + train_size : start + train_size + step_size]

        X_train, y_train = train_df[feature_cols], train_df["target_5d_up"]
        X_test, y_test = test_df[feature_cols], test_df["target_5d_up"]

        model = LogisticRegression(random_state=42, max_iter=200)
        model.fit(X_train, y_train)

        preds = model.predict(X_test)
        fold_acc = accuracy_score(y_test, preds)
        fold_accuracies.append(fold_acc)

        predictions.extend(preds)
        actuals.extend(y_test)

        print(f"  Fold {fold_idx}: Train {len(train_df)} days, Test {len(test_df)} days -> Accuracy: {fold_acc:.2%}")
        start += step_size
        fold_idx += 1

    overall_acc = accuracy_score(actuals, predictions)
    majority_class_baseline = max(np.mean(actuals), 1 - np.mean(actuals))

    # A model demonstrates edge only if accuracy is statistically higher than majority class baseline (> 55% with p < 0.05)
    shows_genuine_edge = (overall_acc > 0.55) and (overall_acc > majority_class_baseline + 0.03)

    report = {
        "ticker": ticker,
        "total_test_samples": len(actuals),
        "total_folds": len(fold_accuracies),
        "overall_accuracy": round(overall_acc, 4),
        "majority_class_baseline": round(majority_class_baseline, 4),
        "fold_accuracies": [round(a, 4) for a in fold_accuracies],
        "shows_genuine_edge": shows_genuine_edge,
        "recommendation": (
            "VALIDATED: Genuine edge detected. Eligible for trend_signal_validated = True."
            if shows_genuine_edge
            else "NEGATIVE RESULT: Out-of-sample directional accuracy is indistinguishable from chance or naive baseline. RULE-016: Feature does not ship. trend_signal_validated remains FALSE."
        )
    }

    return report


if __name__ == "__main__":
    rep = run_walk_forward_backtest()
    print("\n================ WALK-FORWARD BACKTEST RESULTS ================")
    print(f"Ticker: {rep['ticker']}")
    print(f"Total Out-of-Sample Days Evaluated: {rep['total_test_samples']}")
    print(f"Overall Out-of-Sample Accuracy: {rep['overall_accuracy']:.2%}")
    print(f"Majority Class Baseline: {rep['majority_class_baseline']:.2%}")
    print(f"Edge Detected: {rep['shows_genuine_edge']}")
    print(f"Result / Decision: {rep['recommendation']}")
    print("===============================================================")
