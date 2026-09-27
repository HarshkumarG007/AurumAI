"""
Aurum AI — Real Market Data Walk-Forward & Physical Cost Evaluation
===================================================================
Applies the rigorous methodology from `trend_signal_research_pipeline.py`
to the actual historical Indian bullion dataset (2022-2026).
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

def run_real_evaluation():
    df = pd.read_csv("ml_pipeline/data/features_matrix.csv", parse_dates=["date"]).set_index("date")
    print(f"Total Real Data Observations: {len(df)}")

    features = [
        "price_to_ma_7", "price_to_ma_15", "price_to_ma_30", "price_to_ma_50",
        "ret_5d", "ret_15d", "rsi_14", "macd_line", "macd_signal", "vol_15d",
        "bb_pct_b", "gold_silver_ratio", "gold_oil_ratio", "crude_ret_15d",
        "yield_10y_delta_15d", "usdinr_ret_15d"
    ]
    features = [f for f in features if f in df.columns]
    print(f"Features ({len(features)}): {features}")

    target_col = "target_5d_dir"
    fwd_ret_col = "target_5d_ret"

    # Reserve final untouched holdout (last 84 trading days ~ 4 months)
    n_final_holdout = 84
    selection_df = df.iloc[:-n_final_holdout].reset_index(drop=True)
    final_holdout = df.iloc[-n_final_holdout - 252:].reset_index(drop=True)

    train_win = 252
    test_win = 42
    n_folds = (len(selection_df) - train_win) // test_win
    print(f"Selection Window Folds: {n_folds}")

    models = {
        "logistic_elasticnet": LogisticRegression(penalty="l2", solver="saga", max_iter=2000, random_state=42),
        "random_forest": RandomForestClassifier(n_estimators=100, max_depth=4, random_state=42),
        "gradient_boosting": GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=42),
    }

    results = {name: [] for name in models}
    start = 0
    for fold in range(n_folds):
        tr = selection_df.iloc[start : start + train_win]
        te = selection_df.iloc[start + train_win : start + train_win + test_win]
        if len(te) < test_win:
            break
        Xtr, ytr = tr[features], tr[target_col]
        Xte, yte = te[features], te[target_col]
        scaler = StandardScaler().fit(Xtr)
        Xtr_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xte)
        baseline = max(ytr.mean(), 1 - ytr.mean())
        for name, model in models.items():
            model.fit(Xtr_s, ytr)
            acc = model.score(Xte_s, yte)
            results[name].append({"fold": fold, "accuracy": acc, "baseline": baseline, "edge": acc - baseline})
        start += test_win

    summary = pd.DataFrame({
        name: {
            "mean_accuracy": pd.DataFrame(r).accuracy.mean(),
            "mean_baseline": pd.DataFrame(r).baseline.mean(),
            "mean_edge": pd.DataFrame(r).edge.mean()
        }
        for name, r in results.items()
    }).T

    print("\n=== Real Market Data Walk-Forward Model Selection ===")
    print(summary.round(4))

    best_model_name = summary["mean_edge"].idxmax()
    print(f"\nBest Model by Cross-Validation Edge: {best_model_name} (Edge: {summary.loc[best_model_name, 'mean_edge']:.4f})")

    # Evaluate on FINAL UNTOUCHED HOLDOUT
    tr = final_holdout.iloc[:252]
    te = final_holdout.iloc[252:]
    scaler = StandardScaler().fit(tr[features])
    final_model = models[best_model_name]
    final_model.fit(scaler.transform(tr[features]), tr[target_col])
    final_acc = final_model.score(scaler.transform(te[features]), te[target_col])
    final_baseline = max(tr[target_col].mean(), 1 - tr[target_col].mean())
    final_edge = final_acc - final_baseline

    pred_up = final_model.predict(scaler.transform(te[features]))
    fwd_ret = te[fwd_ret_col].values

    # Frictionless vs Physical 4% Roundtrip Cost Strategy Returns
    frictionless_ret = np.where(pred_up == 1, fwd_ret, 0.0)
    physical_ret = np.where(pred_up == 1, fwd_ret - 0.04, 0.0)

    def calc_metrics(r):
        if r.std() == 0: return 0.0, 0.0
        sh = (r.mean() / r.std()) * np.sqrt(52)
        downside = r[r < 0]
        so = (r.mean() / downside.std()) * np.sqrt(52) if len(downside) > 1 and downside.std() > 0 else 0.0
        return sh, so

    sh_f, so_f = calc_metrics(frictionless_ret)
    sh_p, so_p = calc_metrics(physical_ret)

    print("\n=== FINAL UNTOUCHED HOLDOUT RESULTS (REAL BULLION DATA) ===")
    print(f"Final Holdout Accuracy: {final_acc:.4f} | Naive Baseline: {final_baseline:.4f} | Edge: {final_edge:.4f}")
    print(f"Frictionless Strategy: Sharpe={sh_f:.2f}, Sortino={so_f:.2f}")
    print(f"Physical Bullion Strategy (4% round-trip cost): Sharpe={sh_p:.2f}, Sortino={so_p:.2f}")

    gate_pass = (final_edge > 0.03) and (sh_p > 0)
    verdict = "PASS -> trend_signal_validated=TRUE" if gate_pass else "FAIL -> trend_signal_validated stays FALSE"
    print(f"\nRULE-016 & RULE-017 Physical Invariant Gate: {verdict}")

if __name__ == "__main__":
    run_real_evaluation()
