import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface AlertRequestBody {
  chat_id?: number | string;
  preferred_metal: "gold_24k" | "gold_22k" | "silver";
  target_price_inr: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: AlertRequestBody = await req.json();
    const { chat_id, preferred_metal, target_price_inr } = body;

    // Strict input validation (Threat Model Mitigation 4)
    if (!preferred_metal || !["gold_24k", "gold_22k", "silver"].includes(preferred_metal)) {
      return NextResponse.json(
        { ok: false, error: "Invalid metal selected. Must be 'gold_24k', 'gold_22k', or 'silver'." },
        { status: 400 }
      );
    }

    const targetVal = Number(target_price_inr);
    if (isNaN(targetVal) || targetVal <= 0 || targetVal > 5000000) {
      return NextResponse.json(
        { ok: false, error: "Invalid target price. Must be a positive numeric value under ₹50,00,000." },
        { status: 400 }
      );
    }

    // Default chat_id for web demo if none provided
    const userChatId = chat_id ? Number(chat_id) : 999999999;
    if (isNaN(userChatId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid chat_id. Must be numeric." },
        { status: 400 }
      );
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key || url.includes("your-project")) {
      return NextResponse.json({
        ok: true,
        message: "Alert trigger simulated successfully (Supabase mock mode).",
        alert_config: {
          chat_id: userChatId,
          metal: preferred_metal,
          target_price_inr: targetVal,
          status: "ACTIVE",
          cooldown: "48h state-machine suppression enabled",
        },
      });
    }

    const supabase = createClient(url, key);

    // Upsert into users table
    const { error } = await supabase.from("users").upsert(
      {
        chat_id: userChatId,
        preferred_metal,
        target_price_inr: targetVal,
        tts_voice: "hi-IN-SwaraNeural",
      },
      { onConflict: "chat_id" }
    );

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json(
        { ok: false, error: "Database error saving alert preference." },
        { status: 500 }
      );
    }

    // Fetch latest market price to check if immediately triggered
    const { data: latestMarket } = await supabase
      .from("market_data")
      .select("price_inr, ma15")
      .eq("metal", preferred_metal)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();

    const currentPrice = latestMarket?.price_inr ? Number(latestMarket.price_inr) : 157084.6;
    const isTriggered = currentPrice <= targetVal;

    return NextResponse.json({
      ok: true,
      message: `Alert trigger successfully configured for ₹${targetVal.toLocaleString("en-IN")}.`,
      alert_config: {
        chat_id: userChatId,
        metal: preferred_metal,
        target_price_inr: targetVal,
        current_market_price: currentPrice,
        is_triggered_now: isTriggered,
        status: isTriggered ? "TARGET_REACHED" : "WATCHING",
        state_machine: "48h suppression window active to prevent notification spam.",
      },
    });
  } catch (err: any) {
    console.error("Alert creation API error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
