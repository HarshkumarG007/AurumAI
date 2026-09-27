/**
 * Aurum AI - Daily Morning Digest & Retention Purge Cron Route
 * Triggered once daily at 09:00 AM IST (03:30 UTC) via Vercel Cron (Spec §2, §7, §8).
 * Secured via CRON_SECRET header with constant-time comparison (CWE-208 mitigation).
 */

import { NextRequest, NextResponse } from "next/server";
import { getMarketSnapshot, MetalType } from "@/agent/tools/market_tools";
import { sendTelegramTextMessage } from "@/agent/telegram/sender";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const METAL_NAMES: Record<MetalType, string> = {
  gold_24k: "24K Fine Gold",
  gold_22k: "22K Standard Gold",
  silver: "999 Fine Silver",
};

async function executeDailyDigest(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || req.headers.get("x-cron-secret");

  // Verify internal secret token with timing-safe comparison (CWE-208 mitigation)
  const providedSecret = authHeader?.replace("Bearer ", "").trim();
  if (cronSecret && !safeCompare(providedSecret, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your-project")) {
    return NextResponse.json({
      ok: true,
      status: "skipped",
      note: "No live Supabase credentials configured. Running in sandbox mode.",
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch active registered users
    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("chat_id, preferred_metal, tts_voice");

    let processedCount = 0;
    let deliveredCount = 0;

    if (!userErr && users && users.length > 0) {
      for (const user of users) {
        processedCount++;
        const metal: MetalType = (user.preferred_metal as MetalType) || "gold_24k";
        const snapshot = await getMarketSnapshot(metal);
        const metalLabel = METAL_NAMES[metal] || metal;

        let maContext = "";
        if (snapshot.ma15) {
          const dev = ((snapshot.price_inr - snapshot.ma15) / snapshot.ma15) * 100.0;
          if (dev < -0.5) {
            maContext = `Pichle 15 dino ke average (₹${snapshot.ma15.toLocaleString("en-IN")}) se yeh ${Math.abs(dev).toFixed(1)}% kam hai.`;
          } else if (dev > 0.5) {
            maContext = `Pichle 15 dino ke average (₹${snapshot.ma15.toLocaleString("en-IN")}) se yeh ${dev.toFixed(1)}% zyada hai.`;
          } else {
            maContext = `Yeh pichle 15 dino ke average (₹${snapshot.ma15.toLocaleString("en-IN")}) ke lagbhag barabar chal raha hai.`;
          }
        }

        const digestMessage =
          `Namaste! Kaise hain aap?\n\n` +
          `Aaj ${metalLabel} ka taaza landed bhav ₹${snapshot.price_inr.toLocaleString("en-IN")} (per 10g) chal raha hai.\n` +
          `${maContext ? maContext + "\n" : ""}` +
          `Aap mujhse din bhar mein kabhi bhi taaza rate ya affordability pooch sakte hain!`;

        const sent = await sendTelegramTextMessage(user.chat_id, digestMessage, true);
        if (sent) deliveredCount++;
      }
    }

    // 2. Spec §7: 90-Day Retention Cleanup for chat_log
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { count: purgedCount } = await supabase
      .from("chat_log")
      .delete({ count: "exact" })
      .lt("created_at", ninetyDaysAgo);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      processedUsers: processedCount,
      deliveredDigest: deliveredCount,
      retentionPurgedLogs: purgedCount || 0,
    });
  } catch (err: any) {
    console.error("Error executing daily digest:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error during daily digest execution." },
      { status: 500 }
    );
  }
}

// Vercel Cron executes via GET
export async function GET(req: NextRequest) {
  return executeDailyDigest(req);
}

// Support POST for manual administrative triggering
export async function POST(req: NextRequest) {
  return executeDailyDigest(req);
}
