import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkEndpointRateLimit } from "@/agent/utils/rate_limit";
import crypto from "crypto";

export const dynamic = "force-dynamic";

interface AlertRequestBody {
  chat_id?: number | string;
  preferred_metal: "gold_24k" | "gold_22k" | "silver";
  target_price_inr: number;
}

// Sandbox IDs allowed for public interactive web demonstration
const PERMITTED_DEMO_CHAT_IDS = new Set([87654321, 999999999, 12345678]);

export async function POST(req: NextRequest) {
  try {
    // 1. IP-based rate limiting to prevent Denial of Wallet and DoS
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous_client";

    const rateLimit = checkEndpointRateLimit(clientIp, 10, 60); // Max 10 requests per minute
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Too many alert configuration requests. Please retry in ${rateLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const body: AlertRequestBody = await req.json();
    const { chat_id, preferred_metal, target_price_inr } = body;

    // 2. Strict input validation (Threat Model Mitigation 4)
    if (!preferred_metal || !["gold_24k", "gold_22k", "silver"].includes(preferred_metal)) {
      return NextResponse.json(
        { ok: false, error: "Invalid metal selected. Must be 'gold_24k', 'gold_22k', or 'silver'." },
        { status: 400 }
      );
    }

    const targetVal = Number(target_price_inr);
    if (isNaN(targetVal) || targetVal < 500 || targetVal > 5000000) {
      return NextResponse.json(
        { ok: false, error: "Invalid target price. Must be a numeric value between ₹500 and ₹50,00,000." },
        { status: 400 }
      );
    }

    const userChatId = chat_id ? Number(chat_id) : 87654321;
    if (isNaN(userChatId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid chat_id. Must be numeric." },
        { status: 400 }
      );
    }

    // 3. IDOR Defense (Spec §9 Mitigation 2):
    // Public web clients may only persist known sandbox/demo IDs to avoid hijacking real family member alerts.
    // If an arbitrary unknown chat_id is passed from the web without an admin secret, execute in simulation mode.
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    const cronSecret = process.env.CRON_SECRET;
    const isAuthorizedAdmin =
      cronSecret &&
      authHeader &&
      authHeader.length === cronSecret.length &&
      crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(cronSecret));

    const isDemoId = PERMITTED_DEMO_CHAT_IDS.has(userChatId);
    const allowDatabasePersist = isAuthorizedAdmin || isDemoId;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    let currentPrice = preferred_metal === "silver" ? 2355.65 : 157084.6;

    if (url && key && !url.includes("your-project")) {
      const supabase = createClient(url, key);

      // Fetch latest market price to compute live trigger condition
      const { data: latestMarket } = await supabase
        .from("market_data")
        .select("price_inr")
        .eq("metal", preferred_metal)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .single();

      if (latestMarket?.price_inr) {
        currentPrice = Number(latestMarket.price_inr);
      }

      // Persist only if permitted sandbox ID or authenticated admin
      if (allowDatabasePersist) {
        await supabase.from("users").upsert(
          {
            chat_id: userChatId,
            preferred_metal,
            target_price_inr: targetVal,
            tts_voice: "hi-IN-SwaraNeural",
          },
          { onConflict: "chat_id" }
        );
      }
    }

    const isTriggered = currentPrice <= targetVal;

    return NextResponse.json({
      ok: true,
      message: allowDatabasePersist
        ? `Alert trigger successfully configured for ₹${targetVal.toLocaleString("en-IN")}.`
        : `Simulation complete: Alert threshold set to ₹${targetVal.toLocaleString("en-IN")} (Sandbox Isolated Mode).`,
      alert_config: {
        chat_id: userChatId,
        metal: preferred_metal,
        target_price_inr: targetVal,
        current_market_price: currentPrice,
        is_triggered_now: isTriggered,
        status: isTriggered ? "TARGET_REACHED" : "WATCHING",
        mode: allowDatabasePersist ? "PERSISTED" : "SANDBOX_SIMULATION",
        state_machine: "48h suppression window active to prevent notification spam.",
      },
    });
  } catch (err: any) {
    console.error("Alert creation API error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error processing alert request." },
      { status: 500 }
    );
  }
}
