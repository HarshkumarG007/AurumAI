"""
Aurum AI - Phase 1 Verification Test Suite
Verifies all Phase 1 Acceptance Criteria:
1. Schema applies cleanly.
2. Manual pipeline run produces rows with all MA columns populated.
3. Hand-computed spot-check of MA values matches exactly.
4. Cache fallback path (RULE-011) functions properly when yfinance is unavailable.
5. Parameterized SQL verification (RULE-010).
6. RULE-017 trend_signal_validated defaults to False.
"""

import sys
import os
import json
import sqlite3
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml_pipeline.moving_averages import compute_sma, compute_all_mas, compute_ma_deviation_pct
from ml_pipeline.fetch import (
    calculate_landed_inr,
    build_market_records,
    fetch_raw_market_data,
    run_pipeline,
    CACHE_FILE
)


def test_schema_sql_syntax_and_tables():
    """Verify that schema.sql is valid SQL and contains all required tables and constraints."""
    schema_file = ROOT_DIR / "database" / "schema.sql"
    assert schema_file.exists(), "database/schema.sql must exist"
    
    content = schema_file.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS users" in content
    assert "CREATE TABLE IF NOT EXISTS market_data" in content
    assert "CREATE TABLE IF NOT EXISTS alert_history" in content
    assert "CREATE TABLE IF NOT EXISTS chat_log" in content
    assert "trend_signal_validated BOOLEAN NOT NULL DEFAULT FALSE" in content, "RULE-017 must be enforced in schema"
    
    # Test compatibility by parsing statements into a local test SQLite instance
    # Translate Postgres-specific types to SQLite-compatible types for local test
    sqlite_content = content.replace("BIGSERIAL", "INTEGER").replace("TIMESTAMPTZ", "TIMESTAMP").replace("NUMERIC(12, 2)", "REAL").replace("NUMERIC(12, 4)", "REAL").replace("NUMERIC(10, 4)", "REAL").replace("NUMERIC(5, 4)", "REAL").replace("NOW()", "CURRENT_TIMESTAMP")
    
    conn = sqlite3.connect(":memory:")
    cur = conn.cursor()
    cur.executescript(sqlite_content)
    
    # Verify tables were created
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = {row[0] for row in cur.fetchall()}
    assert {"users", "market_data", "alert_history", "chat_log"}.issubset(tables)
    conn.close()


def test_hand_computed_moving_average_spot_check():
    """
    Acceptance Criterion: A hand-computed spot-check of one MA value matches.
    We test both a deterministic synthetic series and a realistic price series.
    """
    # Test 1: 7-day simple sequence
    # Values: [70000, 71000, 72000, 73000, 74000, 75000, 76000]
    # Sum = 511000
    # Mean = 511000 / 7 = 73000.00
    prices_7 = [70000.0, 71000.0, 72000.0, 73000.0, 74000.0, 75000.0, 76000.0]
    expected_ma7 = 73000.00
    actual_ma7 = compute_sma(prices_7, 7)
    assert actual_ma7 == expected_ma7, f"Expected {expected_ma7}, got {actual_ma7}"

    # Test 2: 15-day series hand-computed
    # 15 values of 75000 except the last 3 values are 72000, 71000, 70000
    prices_15 = [75000.0] * 12 + [72000.0, 71000.0, 70000.0]
    # Sum = 12 * 75000 + 72000 + 71000 + 70000 = 900000 + 213000 = 1113000
    # Mean = 1113000 / 15 = 74200.00
    expected_ma15 = 74200.00
    actual_ma15 = compute_sma(prices_15, 15)
    assert actual_ma15 == expected_ma15, f"Expected {expected_ma15}, got {actual_ma15}"

    # Test 3: compute_all_mas populates ma7, ma15, ma30
    prices_30 = [70000.0 + i * 100 for i in range(35)]
    mas = compute_all_mas(prices_30)
    assert mas["ma7"] is not None
    assert mas["ma15"] is not None
    assert mas["ma30"] is not None
    
    # Hand-check 30-day window: last 30 values range from (70000 + 5*100) to (70000 + 34*100)
    # Average of arithmetic progression with 30 terms:
    # First term a1 = 70500, last term a30 = 73400
    # Mean = (70500 + 73400) / 2 = 71950.00
    assert mas["ma30"] == 71950.00


def test_hand_computed_landed_inr_formula():
    """Verify landed INR calculation against exact hand-calculated arithmetic."""
    # Spot = 2500.00 USD/oz
    # FX = 85.00 INR/USD
    # Duty = 15% (0.15), GST = 3% (0.03) -> Total tax multiplier = 1.18
    # Quantity = 10 grams
    # Troy ounce in grams = 31.1034768
    # USD for 10 grams = (2500 / 31.1034768) * 10 = 803.7686566...
    # INR base = 803.7686566... * 85 = 68320.3358...
    # Landed INR = 68320.3358... * 1.18 = 80617.996... -> 80618.00
    expected = 80618.00
    actual = calculate_landed_inr(2500.00, 85.00, duty_pct=0.15, gst_pct=0.03, grams=10.0)
    assert actual == expected, f"Expected {expected}, got {actual}"


def test_manual_pipeline_run_produces_all_ma_columns():
    """
    Acceptance Criterion: Manual run produces a row with all MA columns populated.
    """
    records = run_pipeline()
    assert len(records) == 3, f"Expected 3 metal records, got {len(records)}"
    
    metals = {r["metal"] for r in records}
    assert metals == {"gold_24k", "gold_22k", "silver"}

    for r in records:
        assert r["price_inr"] > 0, f"price_inr must be > 0 for {r['metal']}"
        assert r["price_usd"] > 0, f"price_usd must be > 0 for {r['metal']}"
        assert r["fx_rate"] > 0, f"fx_rate must be > 0 for {r['metal']}"
        assert r["ma7"] is not None, f"ma7 must be populated for {r['metal']}"
        assert r["ma15"] is not None, f"ma15 must be populated for {r['metal']}"
        assert r["ma30"] is not None, f"ma30 must be populated for {r['metal']}"
        assert r["trend_signal_validated"] is False, "RULE-017: trend_signal_validated must be False"
        assert r["source"] in ("yfinance", "cache_fallback")


def test_cache_fallback_path_rule_011():
    """
    RULE-011: Unofficial wrapper yfinance must have an implemented, tested fallback path.
    Verify that if yfinance raises an exception, the pipeline gracefully falls back to cache.
    """
    # Ensure cache exists first
    assert CACHE_FILE.exists(), "Cache file must exist from previous fetch"

    with patch("yfinance.Tickers", side_effect=Exception("Simulated Yahoo Finance Outage")):
        data, source = fetch_raw_market_data()
        assert source == "cache_fallback", "Must return source 'cache_fallback' on yfinance error"
        assert "gold_spot_usd" in data
        assert "silver_spot_usd" in data
        assert "fx_rate" in data

        records = build_market_records(data, source)
        assert len(records) == 3
        for r in records:
            assert r["source"] == "cache_fallback"
            assert r["ma7"] is not None
            assert r["ma15"] is not None
            assert r["ma30"] is not None


def test_no_sql_string_interpolation_rule_010():
    """
    RULE-010: Every SQL query is parameterized. No string-interpolated SQL anywhere.
    """
    fetch_code = (ROOT_DIR / "ml_pipeline" / "fetch.py").read_text(encoding="utf-8")
    assert "f\"INSERT INTO" not in fetch_code, "RULE-010 violation: f-string used in SQL insert"
    assert "f'INSERT INTO" not in fetch_code, "RULE-010 violation: f-string used in SQL insert"
    assert "%s" in fetch_code or "supabase.table" in fetch_code, "Must use parameterized bindings or client SDK"
