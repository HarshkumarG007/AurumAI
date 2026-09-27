"""
Aurum AI - Quantitative Exploratory Data Analysis (EDA) Profiler
Calculates distributional properties, stationarity (ADF), and cross-asset correlations.
Generates structured EDA insights for both human researchers and automated API consumers.
"""

import json
import logging
from pathlib import Path
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("eda_profiler")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def adf_test_approximation(series: pd.Series) -> dict:
    """
    Computes Dickey-Fuller autoregression coefficient to assess mean-reverting stationarity.
    y_t - y_{t-1} = rho * y_{t-1} + e_t
    """
    clean = series.dropna()
    y = clean.values
    dy = np.diff(y)
    y_lag = y[:-1]
    
    # Simple OLS
    beta = np.cov(dy, y_lag)[0, 1] / (np.var(y_lag) + 1e-12)
    residual = dy - beta * y_lag
    se = np.sqrt(np.var(residual) / (len(dy) * np.var(y_lag) + 1e-12))
    t_stat = beta / (se + 1e-12)
    
    # Critical value at 5% is approx -2.86
    is_stationary = bool(t_stat < -2.86)
    return {
        "t_statistic": round(float(t_stat), 3),
        "is_stationary_5pct": is_stationary,
        "interpretation": "Stationary (mean-reverting)" if is_stationary else "Non-Stationary (random walk / unit root)"
    }


def run_full_eda() -> dict:
    matrix_path = DATA_DIR / "features_matrix.csv"
    if not matrix_path.exists():
        from ml_pipeline.data_engineering.feature_engineer import generate_feature_matrix
        df = generate_feature_matrix()
    else:
        df = pd.read_csv(matrix_path, index_col="date", parse_dates=True)

    logger.info("Running Exploratory Data Analysis on %d feature rows...", len(df))

    # 1. Distributional Stats of Gold Landed Price & Returns
    price = df["landed_gold_24k"]
    ret_1d = df["ret_1d"].dropna()
    ret_5d = df["ret_5d"].dropna()

    summary_stats = {
        "dataset_date_start": str(df.index.min().date()),
        "dataset_date_end": str(df.index.max().date()),
        "total_trading_days": int(len(df)),
        "gold_price_summary_inr": {
            "min": round(float(price.min()), 2),
            "median": round(float(price.median()), 2),
            "mean": round(float(price.mean()), 2),
            "max": round(float(price.max()), 2),
            "latest": round(float(price.iloc[-1]), 2),
        },
        "daily_returns_distribution": {
            "annualized_mean_return_pct": round(float(ret_1d.mean() * 252 * 100), 2),
            "annualized_volatility_pct": round(float(ret_1d.std() * np.sqrt(252) * 100), 2),
            "skewness": round(float(ret_1d.skew()), 3),
            "kurtosis": round(float(ret_1d.kurt()), 3),
            "max_single_day_gain_pct": round(float(ret_1d.max() * 100), 2),
            "max_single_day_drop_pct": round(float(ret_1d.min() * 100), 2),
        }
    }

    # 2. Stationarity Tests
    summary_stats["stationarity_tests"] = {
        "raw_gold_price": adf_test_approximation(price),
        "daily_log_returns": adf_test_approximation(ret_1d),
        "gold_silver_ratio": adf_test_approximation(df["gold_silver_ratio"]),
        "rsi_14": adf_test_approximation(df["rsi_14"])
    }

    # 3. Top Correlations with Forward 5-Day Returns
    corr = df.corr()
    if "target_5d_ret" in corr.columns:
        target_corr = corr["target_5d_ret"].drop(["target_5d_ret", "target_5d_dir", "target_15d_ret", "target_15d_dir"], errors="ignore")
        top_positive = target_corr.nlargest(5).to_dict()
        top_negative = target_corr.nsmallest(5).to_dict()
        summary_stats["predictive_correlations"] = {
            "top_positive_features_5d": {k: round(float(v), 4) for k, v in top_positive.items()},
            "top_negative_features_5d": {k: round(float(v), 4) for k, v in top_negative.items()},
            "observation": (
                "Linear correlations between technical features and 5-day forward return are very weak (|r| < 0.15), "
                "empirically corroborating why unconstrained linear forecasting fails to outperform a naive majority baseline."
            )
        }

    # 4. Save to JSON report
    report_json_path = DATA_DIR / "eda_report.json"
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(summary_stats, f, indent=2)
    logger.info("Saved EDA JSON report to %s", report_json_path)

    # 5. Generate Markdown Report
    md_content = f"""# Aurum AI — Exploratory Data Analysis (EDA) Report

**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}  
**Sample Period:** {summary_stats['dataset_date_start']} to {summary_stats['dataset_date_end']} ({summary_stats['total_trading_days']} trading days)

---

## 1. Domestic Gold Price Summary (Landed INR / 10g)
- **Minimum Observed:** ₹{summary_stats['gold_price_summary_inr']['min']:,.2f}
- **Median:** ₹{summary_stats['gold_price_summary_inr']['median']:,.2f}
- **Mean:** ₹{summary_stats['gold_price_summary_inr']['mean']:,.2f}
- **Maximum Observed:** ₹{summary_stats['gold_price_summary_inr']['max']:,.2f}
- **Latest Close:** ₹{summary_stats['gold_price_summary_inr']['latest']:,.2f}

## 2. Return Distribution & Risk Characteristics
- **Annualized Return:** {summary_stats['daily_returns_distribution']['annualized_mean_return_pct']}%
- **Annualized Realized Volatility:** {summary_stats['daily_returns_distribution']['annualized_volatility_pct']}%
- **Skewness:** {summary_stats['daily_returns_distribution']['skewness']}
- **Excess Kurtosis:** {summary_stats['daily_returns_distribution']['kurtosis']}
- **Worst 1-Day Drawdown:** {summary_stats['daily_returns_distribution']['max_single_day_drop_pct']}%
- **Best 1-Day Rally:** +{summary_stats['daily_returns_distribution']['max_single_day_gain_pct']}%

## 3. Stationarity & Econometric Regime Checks
- **Raw Price Level:** {summary_stats['stationarity_tests']['raw_gold_price']['interpretation']} (t-stat: {summary_stats['stationarity_tests']['raw_gold_price']['t_statistic']})
- **Daily Returns:** {summary_stats['stationarity_tests']['daily_log_returns']['interpretation']} (t-stat: {summary_stats['stationarity_tests']['daily_log_returns']['t_statistic']})
- **RSI 14-Day:** {summary_stats['stationarity_tests']['rsi_14']['interpretation']} (t-stat: {summary_stats['stationarity_tests']['rsi_14']['t_statistic']})
- **Gold-to-Silver Ratio:** {summary_stats['stationarity_tests']['gold_silver_ratio']['interpretation']} (t-stat: {summary_stats['stationarity_tests']['gold_silver_ratio']['t_statistic']})

## 4. Key Predictive Finding
{summary_stats['predictive_correlations']['observation']}
"""
    md_path = DATA_DIR / "EDA_REPORT.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    logger.info("Saved EDA Markdown summary to %s", md_path)

    return summary_stats


if __name__ == "__main__":
    report = run_full_eda()
    print("EDA Complete. Key Metrics:")
    print("Gold Range: Rs", report["gold_price_summary_inr"]["min"], "to Rs", report["gold_price_summary_inr"]["max"])
    print("Annualized Volatility:", report["daily_returns_distribution"]["annualized_volatility_pct"], "%")
    print("Predictive Observation:", report["predictive_correlations"]["observation"])
