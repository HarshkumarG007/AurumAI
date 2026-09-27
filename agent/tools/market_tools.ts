/**
 * Aurum AI - Market & User Tools Implementation
 * Complies with Aurum_AI_Specification.md §5, RULE-001, RULE-002, RULE-009, RULE-010, RULE-017.
 */

import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { calculate_landed_inr, build_market_records } from "@/ml_pipeline/fetch_wrapper";

export type MetalType = "gold_22k" | "gold_24k" | "silver";

export interface MarketSnapshot {
  metal: MetalType;
  price_inr: number;
  ma7: number | null;
  ma15: number | null;
  ma30: number | null;
  trend_signal_validated: boolean;
  trend_signal_value?: number | null;
  source: string;
  fetched_at: string;
}

export interface AffordabilityResult {
  budget_inr: number;
  metal: MetalType;
  price_per_gram_inr: number;
  quantity_grams: number;
}

export interface UserTargetResult {
  target_price_inr: number | null;
  preferred_metal: MetalType;
}

// In-memory fallback user targets store (when database is offline or during testing)
const mockUserStore = new Map<number | string, { target_price_inr: number | null; preferred_metal: MetalType }>();

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key && !url.includes("your-project")) {
    return createClient(url, key);
  }
  return null;
}

/**
 * Tool 1: get_market_snapshot(metal)
 * Returns current landed price, MA7, MA15, MA30, and trend_signal_validated flag.
 */
export async function getMarketSnapshot(metal: MetalType): Promise<MarketSnapshot> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("market_data")
        .select("*")
        .eq("metal", metal)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        return {
          metal: data.metal as MetalType,
          price_inr: Number(data.price_inr),
          ma7: data.ma7 ? Number(data.ma7) : null,
          ma15: data.ma15 ? Number(data.ma15) : null,
          ma30: data.ma30 ? Number(data.ma30) : null,
          // RULE-017: trend_signal_validated must be boolean, strictly respected
          trend_signal_validated: Boolean(data.trend_signal_validated),
          trend_signal_value: data.trend_signal_value ? Number(data.trend_signal_value) : null,
          source: data.source || "supabase",
          fetched_at: data.fetched_at,
        };
      }
    } catch (e) {
      console.warn("Supabase query failed, falling back to cache file:", e);
    }
  }

  // Fallback to local cache.json (RULE-011)
  const cachePath = path.resolve(process.cwd(), "ml_pipeline", "cache.json");
  if (fs.existsSync(cachePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      // Landed calculation matching Python pipeline
      const goldSpot = raw.gold_spot_usd;
      const silverSpot = raw.silver_spot_usd;
      const fxRate = raw.fx_rate;
      const duty = Number(process.env.DUTY_PCT || 0.15);
      const gst = Number(process.env.GST_PCT || 0.03);

      let priceInr = 0;
      if (metal === "gold_24k") {
        priceInr = calculate_landed_inr(goldSpot, fxRate, duty, gst, 10.0);
      } else if (metal === "gold_22k") {
        const p24 = calculate_landed_inr(goldSpot, fxRate, duty, gst, 10.0);
        priceInr = Math.round(p24 * (22.0 / 24.0) * 100) / 100;
      } else {
        priceInr = calculate_landed_inr(silverSpot, fxRate, duty, gst, 10.0);
      }

      // Compute simple MAs from cached series if available
      const histUsd = metal === "silver" ? raw.silver_history_usd : raw.gold_history_usd;
      const fxHist = raw.fx_history || [fxRate];
      const inrSeries: number[] = [];
      if (histUsd && fxHist) {
        const len = Math.min(histUsd.length, fxHist.length);
        for (let i = 0; i < len; i++) {
          let p = calculate_landed_inr(histUsd[i], fxHist[i], duty, gst, 10.0);
          if (metal === "gold_22k") p = Math.round(p * (22.0 / 24.0) * 100) / 100;
          inrSeries.push(p);
        }
      }

      const computeWindowAvg = (series: number[], w: number) => {
        if (!series.length) return null;
        const sub = series.length >= w ? series.slice(-w) : series;
        const sum = sub.reduce((a, b) => a + b, 0);
        return Math.round((sum / sub.length) * 100) / 100;
      };

      return {
        metal,
        price_inr: priceInr,
        ma7: computeWindowAvg(inrSeries, 7),
        ma15: computeWindowAvg(inrSeries, 15),
        ma30: computeWindowAvg(inrSeries, 30),
        trend_signal_validated: false, // Default FALSE (RULE-017)
        trend_signal_value: null,
        source: "cache_fallback",
        fetched_at: raw.fetched_at || new Date().toISOString(),
      };
    } catch (err) {
      console.error("Failed to parse cache.json:", err);
    }
  }

  // Baseline fallback if neither DB nor cache exists
  return {
    metal,
    price_inr: 80000.0,
    ma7: 79500.0,
    ma15: 79000.0,
    ma30: 78500.0,
    trend_signal_validated: false,
    trend_signal_value: null,
    source: "default_fallback",
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Tool 2: calculate_affordability(budget_inr, metal)
 * Pure arithmetic, no LLM involvement (RULE-001).
 * Calculates how many grams of metal can be purchased for the given budget.
 */
export async function calculateAffordability(
  budgetInr: number,
  metal: MetalType
): Promise<AffordabilityResult> {
  const snapshot = await getMarketSnapshot(metal);
  // price_inr is for 10 grams, so price per gram = price_inr / 10
  const pricePerGram = snapshot.price_inr / 10.0;
  const quantityGrams = Math.round((budgetInr / pricePerGram) * 1000) / 1000;

  return {
    budget_inr: budgetInr,
    metal,
    price_per_gram_inr: Math.round(pricePerGram * 100) / 100,
    quantity_grams: quantityGrams,
  };
}

/**
 * Tool 3: check_user_target(chat_id)
 * RULE-009: chat_id is always injected from the authenticated webhook context,
 * NEVER supplied by the LLM.
 */
export async function checkUserTarget(
  authenticatedChatId: number | string
): Promise<UserTargetResult> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from("users")
        .select("target_price_inr, preferred_metal")
        .eq("chat_id", authenticatedChatId)
        .single();

      if (data) {
        return {
          target_price_inr: data.target_price_inr ? Number(data.target_price_inr) : null,
          preferred_metal: (data.preferred_metal as MetalType) || "gold_24k",
        };
      }
    } catch (e) {
      console.warn("Failed to check user target in Supabase:", e);
    }
  }

  // Fallback to in-memory store
  const stored = mockUserStore.get(authenticatedChatId);
  return {
    target_price_inr: stored ? stored.target_price_inr : null,
    preferred_metal: stored ? stored.preferred_metal : "gold_24k",
  };
}

/**
 * Tool 4: update_user_target(chat_id, new_target_inr, preferred_metal?)
 * RULE-009: chat_id is always injected from the authenticated webhook context.
 */
export async function updateUserTarget(
  authenticatedChatId: number | string,
  newTargetInr: number,
  preferredMetal?: MetalType
): Promise<{ success: boolean; target_price_inr: number; preferred_metal: MetalType }> {
  const metal = preferredMetal || "gold_24k";
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase.from("users").upsert({
        chat_id: authenticatedChatId,
        target_price_inr: newTargetInr,
        preferred_metal: metal,
      });

      if (!error) {
        return { success: true, target_price_inr: newTargetInr, preferred_metal: metal };
      }
    } catch (e) {
      console.warn("Failed to update user target in Supabase:", e);
    }
  }

  // Fallback to in-memory store
  mockUserStore.set(authenticatedChatId, { target_price_inr: newTargetInr, preferred_metal: metal });
  return { success: true, target_price_inr: newTargetInr, preferred_metal: metal };
}
