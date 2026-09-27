"""
Aurum AI — Trend Signal Research Pipeline (reference implementation)
=====================================================================
This is REAL, RUNNING code, not another spec document. It demonstrates the
corrected validation methodology end to end: leakage-safe feature engineering,
walk-forward model selection, a multiple-comparisons-safe FINAL holdout, and
transaction-cost-aware strategy evaluation for PHYSICAL bullion (not paper
futures).

IMPORTANT — DATA SOURCE:
This sandbox cannot reach Yahoo Finance or any live market data vendor (the
network egress allowlist doesn't include finance data hosts). Every price
series below is SYNTHETIC, built to have realistic statistical properties
(volatility clustering, macro cross-correlations) so the *pipeline logic* can
be genuinely exercised and inspected. It proves nothing about whether real
gold/silver is predictable — that verdict can only come from running this
same code, unmodified except for the data-loading function, against real
data pulled from wherever you actually have network access (your own
machine, GitHub Actions, etc.).
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

rng = np.random.default_rng(42)
N_DAYS = 1100  # ~4.3 trading years

# ---------------------------------------------------------------------------
# 1. SYNTHETIC MULTI-ASSET DATA  (swap this function out for real ingestion)
# ---------------------------------------------------------------------------
def generate_synthetic_market_data(n=N_DAYS):
    dates = pd.bdate_range("2022-01-03", periods=n)

    # GARCH-like volatility clustering for gold daily returns
    vol = np.zeros(n)
    vol[0] = 0.008
    shocks = rng.standard_normal(n)
    for t in range(1, n):
        vol[t] = np.sqrt(0.000002 + 0.08 * (vol[t-1] * shocks[t-1])**2 + 0.90 * vol[t-1]**2)

    gold_ret = 0.0002 + vol * shocks              # gold daily log-return
    # macro factors, each with its own AR(1)-ish process
    dxy_ret   = 0.00005 + 0.006 * rng.standard_normal(n)
    yield10y  = 3.8 + np.cumsum(0.01 * rng.standard_normal(n))
    yield10y  = np.clip(yield10y, 0.5, 8.0)
    crude_ret = 0.0001 + 0.018 * rng.standard_normal(n)
    equity_ret= 0.0003 + 0.011 * rng.standard_normal(n)

    # impose the economically-expected cross-correlations onto gold returns
    dxy_level = 100 * np.exp(np.cumsum(dxy_ret))
    real_yield_delta = np.diff(yield10y, prepend=yield10y[0])
    gold_ret = gold_ret - 0.35 * (dxy_ret) - 0.25 * (real_yield_delta / 100) + 0.10 * (-equity_ret)

    gold_close  = 5800 * np.exp(np.cumsum(gold_ret))            # USD/oz-ish scale
    silver_ret  = 0.6 * gold_ret + 0.012 * rng.standard_normal(n)  # higher beta + own noise
    silver_close= 70 * np.exp(np.cumsum(silver_ret))
    crude_close = 75 * np.exp(np.cumsum(crude_ret))
    equity_close= 4500 * np.exp(np.cumsum(equity_ret))
    fx_usdinr   = 83 * np.exp(np.cumsum(0.0001 + 0.003 * rng.standard_normal(n)))

    df = pd.DataFrame({
        "date": dates, "gold_usd": gold_close, "silver_usd": silver_close,
        "crude_usd": crude_close, "dxy": dxy_level, "us10y": yield10y,
        "equity": equity_close, "usdinr": fx_usdinr,
    }).set_index("date")
    return df


# ---------------------------------------------------------------------------
# 2. LEAKAGE-SAFE FEATURE ENGINEERING (every feature uses only t <= T)
# ---------------------------------------------------------------------------
def engineer_features(df):
    out = df.copy()
    g = out["gold_usd"]

    out["ma7"], out["ma15"], out["ma30"] = g.rolling(7).mean(), g.rolling(15).mean(), g.rolling(30).mean()
    out["ma50"], out["ma200"] = g.rolling(50).mean(), g.rolling(200).mean()
    out["ema12"], out["ema26"] = g.ewm(span=12, adjust=False).mean(), g.ewm(span=26, adjust=False).mean()
    out["macd"] = out["ema12"] - out["ema26"]
    out["macd_signal"] = out["macd"].ewm(span=9, adjust=False).mean()

    delta = g.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    out["rsi14"] = 100 - (100 / (1 + gain / loss.replace(0, np.nan)))

    tr = g.diff().abs()
    out["atr14"] = tr.rolling(14).mean()
    roll_std20 = g.rolling(20).std()
    out["bb_pctb"] = (g - (g.rolling(20).mean() - 2*roll_std20)) / (4*roll_std20)
    out["realized_vol20"] = np.log(g / g.shift(1)).rolling(20).std()

    out["gold_silver_ratio"] = out["gold_usd"] / out["silver_usd"]
    out["gold_oil_ratio"] = out["gold_usd"] / out["crude_usd"]
    out["dxy_chg20"] = out["dxy"].pct_change(20)
    out["us10y_chg20"] = out["us10y"].diff(20)

    # target: direction over the NEXT 5 days (predict forward, using only past features)
    out["fwd_ret_5d"] = out["gold_usd"].shift(-5) / out["gold_usd"] - 1
    out["target_up"] = (out["fwd_ret_5d"] > 0).astype(int)
    return out.dropna()


# ---------------------------------------------------------------------------
# 3. WALK-FORWARD MODEL SELECTION (11 folds) + a FINAL, untouched holdout
#    This is the fix for the multiple-comparisons problem: 4 model families
#    over only 11 folds will produce a "winner" by chance alone unless a
#    separate, never-touched-until-the-end period confirms it.
# ---------------------------------------------------------------------------
FEATURES = ["ma7","ma15","ma30","ma50","macd","macd_signal","rsi14","atr14",
            "bb_pctb","realized_vol20","gold_silver_ratio","gold_oil_ratio",
            "dxy_chg20","us10y_chg20"]

def walk_forward_select(df, train_win=252, test_win=42, n_folds=11):
    models = {
        "logistic_elasticnet": LogisticRegression(penalty="elasticnet", l1_ratio=0.5, solver="saga", max_iter=2000),
        "random_forest": RandomForestClassifier(n_estimators=200, max_depth=4, random_state=42),
        "gradient_boosting": GradientBoostingClassifier(n_estimators=150, max_depth=3, random_state=42),
    }
    results = {name: [] for name in models}
    start = 0
    for fold in range(n_folds):
        tr = df.iloc[start : start + train_win]
        te = df.iloc[start + train_win : start + train_win + test_win]
        if len(te) < test_win:
            break
        Xtr, ytr = tr[FEATURES], tr["target_up"]
        Xte, yte = te[FEATURES], te["target_up"]
        scaler = StandardScaler().fit(Xtr)
        Xtr_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xte)
        baseline = max(ytr.mean(), 1 - ytr.mean())
        for name, model in models.items():
            model.fit(Xtr_s, ytr)
            acc = model.score(Xte_s, yte)
            results[name].append({"fold": fold, "accuracy": acc, "baseline": baseline, "edge": acc - baseline})
        start += test_win
    return {name: pd.DataFrame(r) for name, r in results.items()}


def strategy_returns(model, scaler, df_slice, features, physical_roundtrip_cost=0.0):
    X = scaler.transform(df_slice[features])
    pred_up = model.predict(X)
    fwd_ret = df_slice["fwd_ret_5d"].values
    # long only when the model predicts "up"; pay round-trip cost each time a new position is opened
    strat_ret = np.where(pred_up == 1, fwd_ret - physical_roundtrip_cost, 0.0)
    return strat_ret


def sharpe_sortino(returns, periods_per_year=52):  # ~52 five-day periods/year
    r = np.asarray(returns)
    if r.std() == 0:
        return 0.0, 0.0
    sharpe = (r.mean() / r.std()) * np.sqrt(periods_per_year)
    downside = r[r < 0]
    sortino = (r.mean() / downside.std()) * np.sqrt(periods_per_year) if len(downside) > 1 and downside.std() > 0 else 0.0
    return sharpe, sortino


if __name__ == "__main__":
    raw = generate_synthetic_market_data()
    feat = engineer_features(raw)

    print(f"Rows after feature engineering (post-dropna): {len(feat)}")
    print("\n=== Cross-asset correlation matrix (EDA) ===")
    print(feat[["gold_usd","silver_usd","dxy","us10y","crude_usd","equity"]].pct_change().corr().round(2))

    n_final_holdout = 150
    selection_df = feat.iloc[: -n_final_holdout].reset_index(drop=True)
    final_holdout = feat.iloc[-n_final_holdout - 252 :].reset_index(drop=True)  # needs its own 252-day train tail

    print("\n=== Walk-forward model selection (11 folds, in-sample selection only) ===")
    fold_results = walk_forward_select(selection_df)
    summary = pd.DataFrame({
        name: {"mean_accuracy": r.accuracy.mean(), "mean_baseline": r.baseline.mean(), "mean_edge": r.edge.mean()}
        for name, r in fold_results.items()
    }).T
    print(summary.round(4))

    best_model_name = summary["mean_edge"].idxmax()
    print(f"\nBest by 11-fold selection: {best_model_name} (mean edge {summary.loc[best_model_name,'mean_edge']:.4f})")

    print("\n=== FINAL, once-only holdout check (this is what actually gates deployment) ===")
    tr = final_holdout.iloc[:252]
    te = final_holdout.iloc[252:]
    scaler = StandardScaler().fit(tr[FEATURES])
    models = {
        "logistic_elasticnet": LogisticRegression(penalty="elasticnet", l1_ratio=0.5, solver="saga", max_iter=2000),
        "random_forest": RandomForestClassifier(n_estimators=200, max_depth=4, random_state=42),
        "gradient_boosting": GradientBoostingClassifier(n_estimators=150, max_depth=3, random_state=42),
    }
    final_model = models[best_model_name]
    final_model.fit(scaler.transform(tr[FEATURES]), tr["target_up"])
    final_acc = final_model.score(scaler.transform(te[FEATURES]), te["target_up"])
    final_baseline = max(tr["target_up"].mean(), 1 - tr["target_up"].mean())
    final_edge = final_acc - final_baseline
    print(f"Final holdout accuracy: {final_acc:.4f}  |  baseline: {final_baseline:.4f}  |  edge: {final_edge:.4f}")

    frictionless = strategy_returns(final_model, scaler, te, FEATURES, physical_roundtrip_cost=0.0)
    physical_cost = strategy_returns(final_model, scaler, te, FEATURES, physical_roundtrip_cost=0.04)
    sh_f, so_f = sharpe_sortino(frictionless)
    sh_p, so_p = sharpe_sortino(physical_cost)
    print(f"\nSimulated strategy, FRICTIONLESS (paper/futures-style): Sharpe={sh_f:.2f}  Sortino={so_f:.2f}")
    print(f"Simulated strategy, PHYSICAL BULLION (4% round-trip cost): Sharpe={sh_p:.2f}  Sortino={so_p:.2f}")

    gate_pass = (final_edge > 0.03) and (sh_p > 0)
    print(f"\nRULE-016/017 GATE (edge>3% AND positive PHYSICAL-cost Sharpe): "
          f"{'PASS -> trend_signal_validated=TRUE' if gate_pass else 'FAIL -> trend_signal_validated stays FALSE'}")
