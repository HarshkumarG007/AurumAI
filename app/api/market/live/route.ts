import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/agent/tools/market_tools";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [gold24, gold22, silver] = await Promise.all([
      getMarketSnapshot("gold_24k"),
      getMarketSnapshot("gold_22k"),
      getMarketSnapshot("silver"),
    ]);

    // Calculate percent deviations
    const computeDeviation = (price: number, ma: number | null) => {
      if (!ma || ma <= 0) return 0;
      return Math.round(((price - ma) / ma) * 10000) / 100;
    };

    const payload = {
      timestamp: new Date().toISOString(),
      metals: {
        gold_24k: {
          name: "24K Fine Gold (99.9% Pure)",
          unit: "10 Grams",
          price_inr: gold24.price_inr,
          price_per_gram: Math.round((gold24.price_inr / 10) * 100) / 100,
          ma7: gold24.ma7,
          ma15: gold24.ma15,
          ma30: gold24.ma30,
          dev_ma7: computeDeviation(gold24.price_inr, gold24.ma7),
          dev_ma15: computeDeviation(gold24.price_inr, gold24.ma15),
          dev_ma30: computeDeviation(gold24.price_inr, gold24.ma30),
          trend_validated: gold24.trend_signal_validated,
          source: gold24.source,
          fetched_at: gold24.fetched_at,
        },
        gold_22k: {
          name: "22K Standard Gold (Jewelry 91.6%)",
          unit: "10 Grams",
          price_inr: gold22.price_inr,
          price_per_gram: Math.round((gold22.price_inr / 10) * 100) / 100,
          ma7: gold22.ma7,
          ma15: gold22.ma15,
          ma30: gold22.ma30,
          dev_ma7: computeDeviation(gold22.price_inr, gold22.ma7),
          dev_ma15: computeDeviation(gold22.price_inr, gold22.ma15),
          dev_ma30: computeDeviation(gold22.price_inr, gold22.ma30),
          trend_validated: gold22.trend_signal_validated,
          source: gold22.source,
          fetched_at: gold22.fetched_at,
        },
        silver: {
          name: "999 Fine Silver (99.9% Pure)",
          unit: "10 Grams (Scalable to 1 KG)",
          price_inr: silver.price_inr,
          price_per_gram: Math.round((silver.price_inr / 10) * 100) / 100,
          price_per_kg: Math.round(silver.price_inr * 100 * 100) / 100,
          ma7: silver.ma7,
          ma15: silver.ma15,
          ma30: silver.ma30,
          dev_ma7: computeDeviation(silver.price_inr, silver.ma7),
          dev_ma15: computeDeviation(silver.price_inr, silver.ma15),
          dev_ma30: computeDeviation(silver.price_inr, silver.ma30),
          trend_validated: silver.trend_signal_validated,
          source: silver.source,
          fetched_at: silver.fetched_at,
        },
      },
      taxes: {
        import_duty_pct: 15.0,
        gst_pct: 3.0,
        combined_multiplier: 1.18,
      },
      system_health: {
        database: "Connected (Supabase PostgreSQL)",
        bot_username: "@Aurum_AI_Family_Bot",
        cron_cadence: "Hourly (GitHub Actions)",
      },
    };

    return NextResponse.json({ ok: true, data: payload });
  } catch (error: any) {
    console.error("Failed to fetch live market data:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
