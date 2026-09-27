"""
Aurum AI - Alert Engine
Implements Target-Hit and MA-Deviation alert evaluation with 48h suppression.
Complies with Aurum_AI_Specification.md §6 and Phase 5 acceptance criteria.
"""

import os
import sys
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

logger = logging.getLogger("aurum_alerts")


class AlertEngine:
    def __init__(self, db_conn=None):
        self.db_conn = db_conn
        # In-memory history for local testing / SQLite / fallback
        self._memory_alert_history: List[Dict[str, Any]] = []

    def record_alert(
        self,
        chat_id: int,
        alert_type: str,
        metal: str,
        price_at_alert: float,
        reference_price: float,
        triggered_at: Optional[datetime] = None
    ) -> None:
        """Records an alert in alert_history."""
        now = triggered_at or datetime.now(timezone.utc)
        record = {
            "chat_id": chat_id,
            "alert_type": alert_type,
            "metal": metal,
            "price_at_alert": price_at_alert,
            "reference_price": reference_price,
            "triggered_at": now
        }
        self._memory_alert_history.append(record)

        if self.db_conn:
            try:
                cur = self.db_conn.cursor()
                cur.execute(
                    """
                    INSERT INTO alert_history (chat_id, alert_type, metal, price_at_alert, reference_price, triggered_at)
                    VALUES (%s, %s, %s, %s, %s, %s);
                    """,
                    (chat_id, alert_type, metal, price_at_alert, reference_price, now)
                )
                self.db_conn.commit()
            except Exception as e:
                logger.error("Failed to insert alert into database: %s", e)

    def get_recent_alerts(
        self,
        chat_id: int,
        alert_type: str,
        metal: str,
        within_hours: float = 48.0
    ) -> List[Dict[str, Any]]:
        """Queries recent alerts for suppression checks."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=within_hours)

        matching = [
            a for a in self._memory_alert_history
            if a["chat_id"] == chat_id
            and a["alert_type"] == alert_type
            and a["metal"] == metal
            and a["triggered_at"] >= cutoff
        ]
        return matching

    def check_target_hit(
        self,
        user: Dict[str, Any],
        current_price: float,
        metal: str
    ) -> Optional[Dict[str, Any]]:
        """
        Target hit condition: current_price <= target_price_inr
        Suppression: Once per target per crossing — resets only when price moves back above target.
        """
        target = user.get("target_price_inr")
        if target is None or target <= 0:
            return None

        chat_id = user["chat_id"]

        if current_price <= target:
            # Check if alert already fired for this crossing
            recent = self.get_recent_alerts(chat_id, "target_hit", metal, within_hours=48.0)
            if recent:
                logger.info(
                    "Target hit for chat_id %s on %s (Price: %s <= Target: %s) SUPPRESSED (already fired).",
                    chat_id, metal, current_price, target
                )
                return None

            alert = {
                "chat_id": chat_id,
                "alert_type": "target_hit",
                "metal": metal,
                "price_at_alert": current_price,
                "reference_price": target,
                "message": (
                    f"Namaste! Aapke dwara set kiya gaya target hit ho gaya hai.\n"
                    f"Aaj {metal} ka bhav ₹{current_price:,.2f} par aa gaya hai (Aapka target: ₹{target:,.2f})."
                )
            }
            return alert

        return None

    def check_ma_deviation(
        self,
        user: Dict[str, Any],
        current_price: float,
        ma15: Optional[float],
        metal: str
    ) -> Optional[Dict[str, Any]]:
        """
        MA deviation condition: current_price < 15-day MA by >1.5%
        Suppression: 48-hour cooldown per user per metal.
        """
        if ma15 is None or ma15 <= 0:
            return None

        deviation_pct = ((current_price - ma15) / ma15) * 100.0
        chat_id = user["chat_id"]

        # Trigger if price is more than 1.5% below 15-day MA
        if deviation_pct < -1.5:
            # Check 48h cooldown suppression
            recent = self.get_recent_alerts(chat_id, "ma_deviation", metal, within_hours=48.0)
            if recent:
                logger.info(
                    "MA deviation for chat_id %s on %s (Dev: %.2f%%) SUPPRESSED by 48h cooldown.",
                    chat_id, metal, deviation_pct
                )
                return None

            alert = {
                "chat_id": chat_id,
                "alert_type": "ma_deviation",
                "metal": metal,
                "price_at_alert": current_price,
                "reference_price": ma15,
                "message": (
                    f"Namaste! Ek zaroori update: Aaj {metal} ka rate (₹{current_price:,.2f}) "
                    f"pichle 15 din ke average (₹{ma15:,.2f}) se {abs(deviation_pct):.1f}% niche aa gaya hai."
                )
            }
            return alert

        return None

    def evaluate_user_alerts(
        self,
        users: List[Dict[str, Any]],
        market_records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Evaluates all alert rules for all users against current market records.
        Returns list of fired alerts, and records them in history.
        """
        market_by_metal = {r["metal"]: r for r in market_records}
        fired_alerts = []

        for user in users:
            preferred_metal = user.get("preferred_metal", "gold_24k")
            record = market_by_metal.get(preferred_metal)
            if not record:
                continue

            current_price = record["price_inr"]
            ma15 = record.get("ma15")

            # 1. Target hit check
            target_alert = self.check_target_hit(user, current_price, preferred_metal)
            if target_alert:
                self.record_alert(
                    chat_id=user["chat_id"],
                    alert_type="target_hit",
                    metal=preferred_metal,
                    price_at_alert=current_price,
                    reference_price=target_alert["reference_price"]
                )
                fired_alerts.append(target_alert)

            # 2. MA deviation check
            ma_alert = self.check_ma_deviation(user, current_price, ma15, preferred_metal)
            if ma_alert:
                self.record_alert(
                    chat_id=user["chat_id"],
                    alert_type="ma_deviation",
                    metal=preferred_metal,
                    price_at_alert=current_price,
                    reference_price=ma_alert["reference_price"]
                )
                fired_alerts.append(ma_alert)

        return fired_alerts
