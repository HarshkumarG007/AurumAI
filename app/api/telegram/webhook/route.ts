/**
 * Aurum AI - Telegram Webhook Route
 * Complies with RULE-004 (secret token validation returning 200 OK silently),
 * RULE-005 (immediate 200 OK acknowledgment, async generation),
 * RULE-006, RULE-009, RULE-011, RULE-012, RULE-020, RULE-021.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { handleTelegramUpdate } from "./handler";
import crypto from "crypto";

function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  // RULE-004: Verify the Telegram X-Telegram-Bot-Api-Secret-Token header before any processing.
  // Uses timing-safe constant-time comparison (CWE-208 mitigation).
  // A mismatch returns 200 OK with no further action — do not reveal validation logic via a different status code.
  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
  const configuredSecret = process.env.TELEGRAM_SECRET_TOKEN;

  if (!safeCompare(incomingSecret, configuredSecret)) {
    // Return 200 OK immediately and silently abort processing per RULE-004
    return NextResponse.json({ ok: true, note: "acknowledged" }, { status: 200 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // RULE-005: Acknowledge with 200 OK immediately; perform generation asynchronously
  try {
    after(async () => {
      try {
        await handleTelegramUpdate(body);
      } catch (err) {
        console.error("Unhandled error in async webhook processor:", err);
      }
    });
  } catch {
    // If invoked outside Next.js request context (e.g. unit test), run asynchronously in background
    Promise.resolve()
      .then(() => handleTelegramUpdate(body))
      .catch((err) => console.error("Error in fallback async runner:", err));
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
