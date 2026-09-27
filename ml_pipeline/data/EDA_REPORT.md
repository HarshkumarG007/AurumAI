# Aurum AI — Exploratory Data Analysis (EDA) Report

**Generated:** 2026-09-27 13:42:01  
**Sample Period:** 2024-07-01 to 2026-09-27 (582 trading days)

---

## 1. Domestic Gold Price Summary (Landed INR / 10g)
- **Minimum Observed:** ₹73,865.78
- **Median:** ₹113,127.75
- **Mean:** ₹123,211.34
- **Maximum Observed:** ₹185,709.64
- **Latest Close:** ₹157,084.60

## 2. Return Distribution & Risk Characteristics
- **Annualized Return:** 35.34%
- **Annualized Realized Volatility:** 23.44%
- **Skewness:** -1.062
- **Excess Kurtosis:** 6.293
- **Worst 1-Day Drawdown:** -11.03%
- **Best 1-Day Rally:** +4.59%

## 3. Stationarity & Econometric Regime Checks
- **Raw Price Level:** Non-Stationary (random walk / unit root) (t-stat: -1.157)
- **Daily Returns:** Stationary (mean-reverting) (t-stat: -25.696)
- **RSI 14-Day:** Stationary (mean-reverting) (t-stat: -5.302)
- **Gold-to-Silver Ratio:** Non-Stationary (random walk / unit root) (t-stat: -1.222)

## 4. Key Predictive Finding
Linear correlations between technical features and 5-day forward return are very weak (|r| < 0.15), empirically corroborating why unconstrained linear forecasting fails to outperform a naive majority baseline.
