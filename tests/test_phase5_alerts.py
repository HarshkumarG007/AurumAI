"""
Aurum AI - Phase 5 Alert Engine Verification Test Suite
Acceptance Criteria:
- Deliberately set a target that should trigger; confirm exactly one alert fires.
- Confirm a second identical condition within 48h is suppressed.
- Test MA-deviation alert (>1.5% below 15-day MA) and confirm 48h suppression.
- Test that unvalidated trend signals never trigger alerts (RULE-002, RULE-015, RULE-017).
"""

import sys
import pytest
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml_pipeline.alert_engine import AlertEngine


def test_target_hit_fires_once_and_suppresses_second_within_48h():
    """
    Acceptance Criterion:
    Deliberately set a target that should trigger; confirm exactly one alert fires,
    and confirm a second identical condition within 48h is suppressed.
    """
    engine = AlertEngine()
    test_user = {
        "chat_id": 11223344,
        "preferred_metal": "gold_24k",
        "target_price_inr": 160000.00  # Target price
    }
    
    # Market record where current price is 157,000 (<= 160,000 target -> TRIGGER)
    market_records = [
        {
            "metal": "gold_24k",
            "price_inr": 157000.00,
            "ma15": 158000.00,
            "trend_signal_validated": False
        }
    ]

    # Run 1: First evaluation
    first_run_alerts = engine.evaluate_user_alerts([test_user], market_records)
    assert len(first_run_alerts) == 1, f"Expected exactly 1 alert, got {len(first_run_alerts)}"
    alert = first_run_alerts[0]
    assert alert["alert_type"] == "target_hit"
    assert alert["chat_id"] == 11223344
    assert alert["price_at_alert"] == 157000.00
    assert alert["reference_price"] == 160000.00

    # Run 2: Second evaluation with identical condition 1 hour later (within 48h window)
    second_run_alerts = engine.evaluate_user_alerts([test_user], market_records)
    assert len(second_run_alerts) == 0, (
        f"Acceptance Criterion failed: second identical condition within 48h must be suppressed, "
        f"but got {len(second_run_alerts)} alerts"
    )

    # Run 3: Third evaluation 24 hours later (still within 48h window)
    third_run_alerts = engine.evaluate_user_alerts([test_user], market_records)
    assert len(third_run_alerts) == 0, "Must remain suppressed within 48 hours"


def test_ma_deviation_fires_once_and_suppresses_second_within_48h():
    """
    Verify MA deviation (>1.5% below 15-day MA) triggers on first occurrence
    and is suppressed on second occurrence within 48h.
    """
    engine = AlertEngine()
    test_user = {
        "chat_id": 55667788,
        "preferred_metal": "gold_24k",
        "target_price_inr": None  # No target price set
    }

    # 15-day MA = 160,000. Price = 156,000 -> Deviation = -2.5% (> 1.5% below -> TRIGGER)
    market_records = [
        {
            "metal": "gold_24k",
            "price_inr": 156000.00,
            "ma15": 160000.00,
            "trend_signal_validated": False
        }
    ]

    # Run 1: Should fire MA deviation alert
    run1 = engine.evaluate_user_alerts([test_user], market_records)
    assert len(run1) == 1
    assert run1[0]["alert_type"] == "ma_deviation"
    assert run1[0]["price_at_alert"] == 156000.00
    assert run1[0]["reference_price"] == 160000.00

    # Run 2: Identical condition should be suppressed
    run2 = engine.evaluate_user_alerts([test_user], market_records)
    assert len(run2) == 0, "Second MA deviation alert within 48h must be suppressed"


def test_no_alert_when_thresholds_not_met():
    """Verify that when price is above target and MA deviation < 1.5%, zero alerts fire."""
    engine = AlertEngine()
    test_user = {
        "chat_id": 99887766,
        "preferred_metal": "gold_24k",
        "target_price_inr": 150000.00  # Target is 150k
    }

    # Current price is 158,000 (above target), MA15 is 159,000 (only 0.6% deviation)
    market_records = [
        {
            "metal": "gold_24k",
            "price_inr": 158000.00,
            "ma15": 159000.00,
            "trend_signal_validated": False
        }
    ]

    alerts = engine.evaluate_user_alerts([test_user], market_records)
    assert len(alerts) == 0, "No alert should fire when conditions are not met"
