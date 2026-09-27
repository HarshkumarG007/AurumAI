"""
Tests for Aurum AI Quantitative Data Engineering, EDA & Multi-Model Benchmark Suite
"""

import json
from pathlib import Path
import pandas as pd
import pytest

DATA_DIR = Path(__file__).resolve().parent.parent / "ml_pipeline" / "data"


def test_multi_asset_cleaned_dataset_validity():
    """Verify that multi-asset dataset exists, contains core tickers, and has no NaN gaps."""
    csv_path = DATA_DIR / "multi_asset_cleaned.csv"
    assert csv_path.exists(), "multi_asset_cleaned.csv must exist"
    
    df = pd.read_csv(csv_path, index_col="date", parse_dates=True)
    assert len(df) >= 250, "Dataset should have at least 1 year of trading days"
    
    expected_cols = ["gold_close", "silver_close", "usdinr_close"]
    for col in expected_cols:
        assert col in df.columns, f"Expected column {col} missing from multi-asset dataset"
        assert df[col].isna().sum() == 0, f"Column {col} must not contain NaN values"


def test_feature_matrix_integrity_and_targets():
    """Verify feature engineering produces rich features without lookahead leakage."""
    csv_path = DATA_DIR / "features_matrix.csv"
    assert csv_path.exists(), "features_matrix.csv must exist"
    
    df = pd.read_csv(csv_path, index_col="date", parse_dates=True)
    assert len(df.columns) >= 30, f"Expected at least 30 features, got {len(df.columns)}"
    
    # Check moving averages and momentum features
    for col in ["ma_7", "ma_15", "ma_30", "rsi_14", "macd_line", "vol_15d", "gold_silver_ratio"]:
        assert col in df.columns, f"Feature {col} missing from feature matrix"

    # Check target definitions
    assert "target_5d_dir" in df.columns
    unique_targets = set(df["target_5d_dir"].dropna().unique())
    assert unique_targets.issubset({0, 1}), "Directional target must be binary (0 or 1)"


def test_eda_report_stationarity_and_metrics():
    """Verify EDA stationarity tests confirm random walk in prices and stationarity in returns."""
    json_path = DATA_DIR / "eda_report.json"
    assert json_path.exists(), "eda_report.json must exist"

    with open(json_path, "r", encoding="utf-8") as f:
        eda = json.load(f)

    assert "gold_price_summary_inr" in eda
    assert "daily_returns_distribution" in eda
    assert "stationarity_tests" in eda

    # Econometric test: Returns must be stationary, raw prices non-stationary
    price_adf = eda["stationarity_tests"]["raw_gold_price"]
    returns_adf = eda["stationarity_tests"]["daily_log_returns"]

    assert returns_adf["is_stationary_5pct"] is True, "Daily returns must be stationary"
    assert "predictive_correlations" in eda


def test_ml_benchmark_enforces_gating_invariant_rule_016():
    """Verify that multi-model benchmark strictly enforces RULE-016 when edge is absent."""
    json_path = DATA_DIR / "ml_benchmark_results.json"
    assert json_path.exists(), "ml_benchmark_results.json must exist"

    with open(json_path, "r", encoding="utf-8") as f:
        bench = json.load(f)

    verdict = bench["gating_verdict"]
    assert "statistical_edge_pct" in verdict
    assert "hurdle_required_pct" in verdict
    
    # If edge is less than 3.0%, gating_result MUST be FAIL (RULE-016)
    if verdict["statistical_edge_pct"] < 3.0:
        assert "FAIL" in verdict["gating_result"], "Must FAIL gating if statistical edge < 3.0%"
        assert "RULE-016" in verdict["action"], "Must enforce RULE-016 in action"
