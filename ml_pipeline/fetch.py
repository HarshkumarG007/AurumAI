"""
Aurum AI - Price Fetch & Ingestion Pipeline
Pulls live market prices for Gold, Silver, and USD/INR via yfinance.
Calculates Indian retail landed estimates (spot x FX x (1 + duty + GST)).
Computes MA7, MA15, MA30 moving averages.
Writes records to Supabase market_data table using parameterized writes (RULE-010).
Implements explicit cache fallback per RULE-011.
"""

import os
import json
import logging
from datetime import datetime, timezone
import sys
from pathlib import Path

from typing import Dict, Any, Optional, Tuple, List
from dotenv import load_dotenv
import yfinance as yf

# Add project root to sys.path so modules resolve whether invoked directly or as module
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from ml_pipeline.moving_averages import compute_all_mas

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("aurum_fetch")

CACHE_FILE = Path(__file__).parent / "cache.json"

# Constants & Defaults
TROY_OUNCE_IN_GRAMS = 31.1034768
DEFAULT_DUTY_PCT = float(os.getenv("DUTY_PCT", "0.15"))  # 15% effective import duty (10% BCD + 5% AIDC)
DEFAULT_GST_PCT = float(os.getenv("GST_PCT", "0.03"))    # 3% GST on physical bullion


def calculate_landed_inr(
    spot_usd_per_oz: float,
    fx_rate: float,
    duty_pct: float = DEFAULT_DUTY_PCT,
    gst_pct: float = DEFAULT_GST_PCT,
    grams: float = 10.0
) -> float:
    """
    Computes landed INR estimate for `grams` of precious metal.
    Formula: (spot_usd / 31.1034768) * grams * fx_rate * (1 + duty_pct + gst_pct)
    """
    usd_per_gram = spot_usd_per_oz / TROY_OUNCE_IN_GRAMS
    usd_for_quantity = usd_per_gram * grams
    inr_base = usd_for_quantity * fx_rate
    inr_total = inr_base * (1.0 + duty_pct + gst_pct)
    return round(inr_total, 2)


def fetch_raw_market_data() -> Tuple[Dict[str, Any], str]:
    """
    Pulls GC=F (Gold), SI=F (Silver), INR=X (USD/INR) from yfinance.
    Returns (data_dict, source_str).
    If yfinance fails or raises an error, falls back to local cache per RULE-011.
    """
    try:
        logger.info("Fetching market data from yfinance (GC=F, SI=F, INR=X)...")
        tickers = yf.Tickers("GC=F SI=F INR=X")
        
        # Download recent history (45 days) to compute trailing historical daily prices & MAs
        hist_gold = tickers.tickers["GC=F"].history(period="60d")
        hist_silver = tickers.tickers["SI=F"].history(period="60d")
        hist_inr = tickers.tickers["INR=X"].history(period="60d")

        if hist_gold.empty or hist_silver.empty or hist_inr.empty:
            raise ValueError("One or more tickers returned empty historical series from yfinance")

        gold_spot = float(hist_gold["Close"].iloc[-1])
        silver_spot = float(hist_silver["Close"].iloc[-1])
        fx_rate = float(hist_inr["Close"].iloc[-1])

        # Align historical daily close prices for MA calculations
        # Using minimum available common length across tickers
        common_len = min(len(hist_gold["Close"]), len(hist_silver["Close"]), len(hist_inr["Close"]))
        gold_series = hist_gold["Close"].iloc[-common_len:].tolist()
        silver_series = hist_silver["Close"].iloc[-common_len:].tolist()
        inr_series = hist_inr["Close"].iloc[-common_len:].tolist()

        data = {
            "gold_spot_usd": gold_spot,
            "silver_spot_usd": silver_spot,
            "fx_rate": fx_rate,
            "gold_history_usd": gold_series,
            "silver_history_usd": silver_series,
            "fx_history": inr_series,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

        # Update cache on success
        save_to_cache(data)
        return data, "yfinance"

    except Exception as e:
        logger.warning("yfinance fetch failed: %s. Engaging RULE-011 cache fallback...", e)
        cached_data = load_from_cache()
        if cached_data:
            return cached_data, "cache_fallback"
        raise RuntimeError("yfinance failed and no cache_fallback is available.") from e


def save_to_cache(data: Dict[str, Any]) -> None:
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info("Saved latest market data to local cache: %s", CACHE_FILE)
    except Exception as e:
        logger.warning("Failed to save cache file: %s", e)


def load_from_cache() -> Optional[Dict[str, Any]]:
    if not CACHE_FILE.exists():
        return None
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error("Failed to read cache file: %s", e)
        return None


def build_market_records(raw_data: Dict[str, Any], source: str) -> List[Dict[str, Any]]:
    """
    Constructs the 3 metal records (gold_24k, gold_22k, silver) with MAs and landed INR prices.
    Prices are per 10 grams in INR.
    """
    gold_spot = raw_data["gold_spot_usd"]
    silver_spot = raw_data["silver_spot_usd"]
    fx_rate = raw_data["fx_rate"]
    fetched_at = raw_data.get("fetched_at", datetime.now(timezone.utc).isoformat())

    duty_pct = DEFAULT_DUTY_PCT
    gst_pct = DEFAULT_GST_PCT

    # Compute historical series in INR for MA calculation
    gold_hist_usd = raw_data.get("gold_history_usd", [gold_spot])
    silver_hist_usd = raw_data.get("silver_history_usd", [silver_spot])
    fx_hist = raw_data.get("fx_history", [fx_rate])

    gold_24k_inr_series = [
        calculate_landed_inr(g_usd, fx, duty_pct, gst_pct, grams=10.0)
        for g_usd, fx in zip(gold_hist_usd, fx_hist)
    ]
    gold_22k_inr_series = [
        round(p * (22.0 / 24.0), 2)
        for p in gold_24k_inr_series
    ]
    silver_inr_series = [
        calculate_landed_inr(s_usd, fx, duty_pct, gst_pct, grams=10.0)
        for s_usd, fx in zip(silver_hist_usd, fx_hist)
    ]

    current_gold_24k = gold_24k_inr_series[-1]
    current_gold_22k = gold_22k_inr_series[-1]
    current_silver = silver_inr_series[-1]

    mas_24k = compute_all_mas(gold_24k_inr_series)
    mas_22k = compute_all_mas(gold_22k_inr_series)
    mas_silver = compute_all_mas(silver_inr_series)

    records = [
        {
            "metal": "gold_24k",
            "price_inr": current_gold_24k,
            "price_usd": round(gold_spot, 4),
            "fx_rate": round(fx_rate, 4),
            "duty_pct": duty_pct,
            "gst_pct": gst_pct,
            "ma7": mas_24k["ma7"],
            "ma15": mas_24k["ma15"],
            "ma30": mas_24k["ma30"],
            "trend_signal_value": None,
            "trend_signal_validated": False,  # RULE-017
            "source": source,
            "fetched_at": fetched_at,
        },
        {
            "metal": "gold_22k",
            "price_inr": current_gold_22k,
            "price_usd": round(gold_spot * (22.0 / 24.0), 4),
            "fx_rate": round(fx_rate, 4),
            "duty_pct": duty_pct,
            "gst_pct": gst_pct,
            "ma7": mas_22k["ma7"],
            "ma15": mas_22k["ma15"],
            "ma30": mas_22k["ma30"],
            "trend_signal_value": None,
            "trend_signal_validated": False,  # RULE-017
            "source": source,
            "fetched_at": fetched_at,
        },
        {
            "metal": "silver",
            "price_inr": current_silver,
            "price_usd": round(silver_spot, 4),
            "fx_rate": round(fx_rate, 4),
            "duty_pct": duty_pct,
            "gst_pct": gst_pct,
            "ma7": mas_silver["ma7"],
            "ma15": mas_silver["ma15"],
            "ma30": mas_silver["ma30"],
            "trend_signal_value": None,
            "trend_signal_validated": False,  # RULE-017
            "source": source,
            "fetched_at": fetched_at,
        }
    ]
    return records


def write_records_to_supabase(records: List[Dict[str, Any]]) -> bool:
    """
    Writes market records to Supabase using either supabase-py client or direct psycopg2 connection.
    Complies with RULE-010 (parameterized queries only).
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    supabase_db_url = os.getenv("SUPABASE_DB_URL")

    # If supabase client credentials exist
    if supabase_url and supabase_key and "your-project" not in supabase_url:
        try:
            from supabase import create_client
            supabase = create_client(supabase_url, supabase_key)
            for record in records:
                supabase.table("market_data").insert(record).execute()
            logger.info("Successfully inserted %d records to Supabase via REST API.", len(records))
            return True
        except Exception as e:
            logger.error("Error inserting via Supabase REST API: %s", e)

    # Alternatively, direct PostgreSQL connection via psycopg2
    if supabase_db_url and "your-password" not in supabase_db_url:
        try:
            import psycopg2
            conn = psycopg2.connect(supabase_db_url)
            cursor = conn.cursor()
            insert_sql = """
                INSERT INTO market_data (
                    metal, price_inr, price_usd, fx_rate, duty_pct, gst_pct,
                    ma7, ma15, ma30, trend_signal_value, trend_signal_validated, source, fetched_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """
            for r in records:
                cursor.execute(insert_sql, (
                    r["metal"], r["price_inr"], r["price_usd"], r["fx_rate"],
                    r["duty_pct"], r["gst_pct"], r["ma7"], r["ma15"], r["ma30"],
                    r["trend_signal_value"], r["trend_signal_validated"], r["source"], r["fetched_at"]
                ))
            conn.commit()
            cursor.close()
            conn.close()
            logger.info("Successfully inserted %d records to Postgres via psycopg2.", len(records))
            return True
        except Exception as e:
            logger.error("Error inserting via psycopg2: %s", e)

    logger.warning("No valid live Supabase credentials configured in environment.")
    return False


def run_pipeline() -> List[Dict[str, Any]]:
    """
    Executes the ingestion pipeline:
    1. Fetch raw data (with fallback)
    2. Build records with MAs and landed INR
    3. Persist to database
    4. Returns generated records
    """
    raw_data, source = fetch_raw_market_data()
    records = build_market_records(raw_data, source)
    write_records_to_supabase(records)
    return records


if __name__ == "__main__":
    records = run_pipeline()
    print("\n--- Pipeline Run Summary ---")
    for r in records:
        print(f"Metal: {r['metal']}")
        print(f"  Price (INR/10g): ₹{r['price_inr']:,.2f} [Source: {r['source']}]")
        print(f"  Spot (USD): ${r['price_usd']:,.2f} | FX: {r['fx_rate']}")
        print(f"  MA7: ₹{r['ma7']} | MA15: ₹{r['ma15']} | MA30: ₹{r['ma30']}")
        print(f"  Trend Validated: {r['trend_signal_validated']}")
