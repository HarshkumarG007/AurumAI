/**
 * Aurum AI - Shared Landed Price Math Helper for TypeScript
 * Mirrors the exact formula in ml_pipeline/fetch.py
 */

export const TROY_OUNCE_IN_GRAMS = 31.1034768;

export function calculate_landed_inr(
  spot_usd_per_oz: number,
  fx_rate: number,
  duty_pct: number = 0.15,
  gst_pct: number = 0.03,
  grams: number = 10.0
): number {
  const usd_per_gram = spot_usd_per_oz / TROY_OUNCE_IN_GRAMS;
  const usd_for_quantity = usd_per_gram * grams;
  const inr_base = usd_for_quantity * fx_rate;
  const inr_total = inr_base * (1.0 + duty_pct + gst_pct);
  return Math.round(inr_total * 100) / 100;
}
