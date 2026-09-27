"""
Aurum AI - Phase 6 Trend Signal Gating & Backtest Verification Test Suite
Acceptance Criteria:
- Walk-forward backtest completed and reported honestly.
- trend_signal_validated only set TRUE if backtest shows edge; if not, deliverable is the honest negative finding.
- Verifies RULE-015, RULE-016, and RULE-017 across code, schema, and agent layers.
"""

import sys
import pytest
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml_pipeline.fetch import build_market_records
from ml_pipeline.trend_signal.backtest import run_walk_forward_backtest


def test_trend_signal_validated_invariant_in_pipeline():
    """RULE-017: trend_signal_validated must be strictly False in all generated market records."""
    dummy_data = {
        "gold_spot_usd": 2500.0,
        "silver_spot_usd": 30.0,
        "fx_rate": 85.0,
        "fetched_at": "2026-09-27T00:00:00Z"
    }
    records = build_market_records(dummy_data, source="test")
    for r in records:
        assert r["trend_signal_validated"] is False, "RULE-017: trend_signal_validated must be False"
        assert r["trend_signal_value"] is None, "trend_signal_value must be None when unvalidated"


def test_schema_has_false_default_for_trend_signal():
    """RULE-017: Schema must set trend_signal_validated default to FALSE."""
    schema_sql = (ROOT_DIR / "database" / "schema.sql").read_text(encoding="utf-8")
    assert "trend_signal_validated BOOLEAN NOT NULL DEFAULT FALSE" in schema_sql


def test_backtest_reports_negative_finding_honestly():
    """
    Acceptance Criterion: Walk-forward backtest reports honestly.
    Validates that our backtest correctly identifies lack of edge over majority baseline
    and recommends feature NOT ship per RULE-016.
    """
    report = run_walk_forward_backtest(ticker="GC=F", period="2y")
    assert "overall_accuracy" in report
    assert "majority_class_baseline" in report
    assert "shows_genuine_edge" in report
    assert "recommendation" in report

    # If edge is not detected, recommendation must explicitly mandate trend_signal_validated remains FALSE
    if not report["shows_genuine_edge"]:
        assert "trend_signal_validated remains FALSE" in report["recommendation"]
        assert "RULE-016: Feature does not ship" in report["recommendation"]
