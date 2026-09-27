/**
 * Aurum AI - Process Alerts Cron Route
 * Invoked by GitHub Actions hourly job. Secured via CRON_SECRET header (Spec §10, §13).
 */

import { NextRequest, NextResponse } from "next/server";
import { getMarketSnapshot } from "@/agent/tools/market_tools";
import { sendTelegramTextMessage } from "@/agent/telegram/sender";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || req.headers.get("x-cron-secret");

  // Verify internal secret token
  const providedSecret = authHeader?.replace("Bearer ", "");
  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your-project")) {
    return NextResponse.json({
      status: "skipped",
      note: "No live Supabase credentials configured",
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active users with target prices
    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("chat_id, preferred_metal, target_price_inr")
      .not("target_price_inr", "is", null);

    if (userErr || !users || users.length === 0) {
      return NextResponse.json({ status: "ok", processedUsers: 0, firedAlerts: 0 });
    }

    const firedAlerts = [];
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    for (const user of users) {
      const metal = user.preferred_metal || "gold_24k";
      const target = Number(user.target_price_inr);
      const snapshot = await getMarketSnapshot(metal);

      // 1. Check Target Hit (current_price <= target)
      if (snapshot.price_inr <= target) {
        // Check suppression: alert fired in last 48 hours
        const { data: existing } = await supabase
          .from("alert_history")
          .select("id")
          .eq("chat_id", user.chat_id)
          .eq("alert_type", "target_hit")
          .eq("metal", metal)
          .gte("triggered_at", fortyEightHoursAgo)
          .limit(1);

        if (!existing || existing.length === 0) {
          const alertMsg =
            `Namaste! Aapke dwara set kiya gaya target hit ho gaya hai.\n\n` +
            `Aaj ${metal} ka rate ₹${snapshot.price_inr.toLocaleString("en-IN")} par aa gaya hai (Aapka target: ₹${target.toLocaleString("en-IN")}).`;

          await sendTelegramTextMessage(user.chat_id, alertMsg, true);

          // Record alert in history
          await supabase.from("alert_history").insert({
            chat_id: user.chat_id,
            alert_type: "target_hit",
            metal,
            price_at_alert: snapshot.price_inr,
            reference_price: target,
          });

          firedAlerts.push({ chat_id: user.chat_id, type: "target_hit", metal });
        }
      }

      // 2. Check MA Deviation (price < MA15 by > 1.5%)
      if (snapshot.ma15) {
        const deviationPct = ((snapshot.price_inr - snapshot.ma15) / snapshot.ma15) * 100.0;
        if (deviationPct < -1.5) {
          const { data: existingMa } = await supabase
            .from("alert_history")
            .select("id")
            .eq("chat_id", user.chat_id)
            .eq("alert_type", "ma_deviation")
            .eq("metal", metal)
            .gte("triggered_at", fortyEightHoursAgo)
            .limit(1);

          if (!existingMa || existingMa.length === 0) {
            const maAlertMsg =
              `Namaste! Aaj ${metal} ka rate (₹${snapshot.price_inr.toLocaleString("en-IN")}) ` +
              `pichle 15 din ke average (₹${snapshot.ma15.toLocaleString("en-IN")}) se ${Math.abs(deviationPct).toFixed(1)}% niche aa gaya hai.`;

            await sendTelegramTextMessage(user.chat_id, maAlertMsg, true);

            await supabase.from("alert_history").insert({
              chat_id: user.chat_id,
              alert_type: "ma_deviation",
              metal,
              price_at_alert: snapshot.price_inr,
              reference_price: snapshot.ma15,
            });

            firedAlerts.push({ chat_id: user.chat_id, type: "ma_deviation", metal });
          }
        }
      }
    }

    return NextResponse.json({
      status: "ok",
      processedUsers: users.length,
      firedAlerts: firedAlerts.length,
      alerts: firedAlerts,
    });
  } catch (err) {
    console.error("Error processing alerts:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
