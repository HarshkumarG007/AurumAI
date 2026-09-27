"""
Aurum AI - Quantitative Multi-Model Machine Learning Benchmark
Evaluates four distinct model families across rolling walk-forward folds.
Enforces RULE-016 & RULE-017 gating invariants.
"""

import json
import logging
from pathlib import Path
import pandas as pd
import numpy as np

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, brier_score_loss

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ml_benchmark")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def run_benchmark():
    matrix_path = DATA_DIR / "features_matrix.csv"
    if not matrix_path.exists():
        from ml_pipeline.data_engineering.feature_engineer import generate_feature_matrix
        df = generate_feature_matrix()
    else:
        df = pd.read_csv(matrix_path, index_col="date", parse_dates=True)

    # Exclude targets and non-stationary raw price levels from feature set
    exclude_cols = [
        "landed_gold_24k", "landed_silver_10g", "ma_7", "ma_15", "ma_30", "ma_50", "ma_200",
        "target_5d_ret", "target_5d_dir", "target_15d_ret", "target_15d_dir"
    ]
    feature_cols = [c for c in df.columns if c not in exclude_cols]
    
    # Drop rows where target is NaN (last 5 rows)
    clean_df = df.dropna(subset=["target_5d_dir"] + feature_cols).copy()
    X = clean_df[feature_cols].values
    y = clean_df["target_5d_dir"].values

    total_samples = len(X)
    train_window = 252
    test_window = 42
    
    models = {
        "naive_majority": lambda: DummyClassifier(strategy="most_frequent"),
        "regularized_logistic": lambda: LogisticRegression(C=0.1, max_iter=200, random_state=42),
        "random_forest": lambda: RandomForestClassifier(n_estimators=100, max_depth=3, min_samples_leaf=5, random_state=42),
        "hist_gradient_boosting": lambda: HistGradientBoostingClassifier(max_iter=50, max_depth=3, min_samples_leaf=10, random_state=42),
    }

    results = {m: {"accuracies": [], "precisions": [], "recalls": [], "brier_scores": []} for m in models}
    
    fold = 0
    start = 0
    while start + train_window + test_window <= total_samples:
        fold += 1
        X_train = X[start : start + train_window]
        y_train = y[start : start + train_window]
        
        X_test = X[start + train_window : start + train_window + test_window]
        y_test = y[start + train_window : start + train_window + test_window]

        # Standardize using ONLY train statistics (prevent leakage!)
        mean = np.mean(X_train, axis=0)
        std = np.std(X_train, axis=0) + 1e-9
        X_train_scaled = (X_train - mean) / std
        X_test_scaled = (X_test - mean) / std

        for name, model_fn in models.items():
            clf = model_fn()
            clf.fit(X_train_scaled, y_train)
            preds = clf.predict(X_test_scaled)
            probs = clf.predict_proba(X_test_scaled)[:, 1] if hasattr(clf, "predict_proba") else preds

            acc = accuracy_score(y_test, preds)
            prec = precision_score(y_test, preds, zero_division=0)
            rec = recall_score(y_test, preds, zero_division=0)
            brier = brier_score_loss(y_test, probs)

            results[name]["accuracies"].append(acc)
            results[name]["precisions"].append(prec)
            results[name]["recalls"].append(rec)
            results[name]["brier_scores"].append(brier)

        start += test_window

    logger.info("Executed %d rolling walk-forward folds across %d total samples.", fold, total_samples)

    summary = {
        "total_folds": fold,
        "train_window_days": train_window,
        "test_window_days": test_window,
        "models_performance": {}
    }

    for name, data in results.items():
        mean_acc = round(float(np.mean(data["accuracies"]) * 100), 2)
        mean_prec = round(float(np.mean(data["precisions"]) * 100), 2)
        mean_rec = round(float(np.mean(data["recalls"]) * 100), 2)
        mean_brier = round(float(np.mean(data["brier_scores"])), 4)
        min_acc = round(float(np.min(data["accuracies"]) * 100), 2)

        summary["models_performance"][name] = {
            "mean_out_of_sample_accuracy_pct": mean_acc,
            "mean_precision_pct": mean_prec,
            "mean_recall_pct": mean_rec,
            "mean_brier_score": mean_brier,
            "worst_fold_accuracy_pct": min_acc
        }

    # Evaluate Gating Invariant (RULE-016)
    baseline_acc = summary["models_performance"]["naive_majority"]["mean_out_of_sample_accuracy_pct"]
    best_candidate_acc = max(
        summary["models_performance"]["regularized_logistic"]["mean_out_of_sample_accuracy_pct"],
        summary["models_performance"]["random_forest"]["mean_out_of_sample_accuracy_pct"],
        summary["models_performance"]["hist_gradient_boosting"]["mean_out_of_sample_accuracy_pct"]
    )
    edge = round(best_candidate_acc - baseline_acc, 2)

    summary["gating_verdict"] = {
        "naive_majority_baseline_pct": baseline_acc,
        "best_candidate_accuracy_pct": best_candidate_acc,
        "statistical_edge_pct": edge,
        "hurdle_required_pct": 3.0,
        "gating_result": "FAIL (Feature Does Not Ship)" if edge < 3.0 else "PASS",
        "action": "Enforce RULE-016 and RULE-017: trend_signal_validated strictly FALSE. Agent maintains complete silence on price direction."
    }

    out_file = DATA_DIR / "ml_benchmark_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    logger.info("Saved ML benchmark report to %s", out_file)
    return summary


if __name__ == "__main__":
    res = run_benchmark()
    print("--- Multi-Model Walk-Forward Benchmark Summary ---")
    for m, p in res["models_performance"].items():
        print(f"{m:25s} | Accuracy: {p['mean_out_of_sample_accuracy_pct']}% | Worst Fold: {p['worst_fold_accuracy_pct']}% | Brier: {p['mean_brier_score']}")
    print("\nGating Verdict:", res["gating_verdict"]["gating_result"])
    print(f"Edge: {res['gating_verdict']['statistical_edge_pct']}% (Hurdle: {res['gating_verdict']['hurdle_required_pct']}%)")
