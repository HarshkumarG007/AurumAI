/**
 * Aurum AI - Telegram Webhook Route
 * Complies with RULE-004 (secret token validation returning 200 OK silently),
 * RULE-005 (immediate 200 OK acknowledgment, async generation),
 * RULE-006, RULE-009, RULE-011, RULE-012, RULE-020, RULE-021.
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { runAurumAgent } from "@/agent/gemini_agent";
import { checkRateLimit } from "@/agent/utils/rate_limit";
import { generateOggVoiceNote } from "@/agent/tts/voice_pipeline";
import {
  sendTelegramTextMessage,
  sendTelegramVoiceNote,
  logInteraction,
} from "@/agent/telegram/sender";

export async function POST(req: NextRequest) {
  // RULE-004: Verify the Telegram X-Telegram-Bot-Api-Secret-Token header before any processing.
  // A mismatch returns 200 OK with no further action — do not reveal validation logic via a different status code.
  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
  const configuredSecret = process.env.TELEGRAM_SECRET_TOKEN;

  if (!configuredSecret || incomingSecret !== configuredSecret) {
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

export async function handleTelegramUpdate(update: any) {
  const message = update?.message || update?.edited_message;
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const userText = message.text || message.caption || "";

  // Handle /start command
  if (userText === "/start") {
    const greeting =
      "Namaste! Main Aurum AI hoon. Main aapke parivaar ke liye sona aur chandi ke taaza bhav aur pichle dino ke daam ka hisaab laata hoon, taaki aap sahi jaankaari ke saath apna faisla le sakein.\n\nAap mujhse aasaani se pooch sakte hain:\n• 'Aaj sone ka kya bhav hai?'\n• 'Chandi ka rate kya chal raha hai?'\n• '50,000 rupaye mein kitna sona aayega?'";
    await sendTelegramTextMessage(chatId, greeting, false);
    await logInteraction(chatId, "incoming_text", userText);
    await logInteraction(chatId, "outgoing_text", greeting);
    return;
  }

  // RULE-020: Rate limit per chat_id before invoking Gemini
  const rateLimitStatus = checkRateLimit(chatId);
  if (!rateLimitStatus.allowed) {
    const fallbackMessage =
      "Mujhe abhi thoda time lagega, ek minute mein bataata hoon.";
    await sendTelegramTextMessage(chatId, fallbackMessage, false);
    return;
  }

  await logInteraction(chatId, "incoming_text", userText);

  // Invoke LLM Agent
  const agentResponse = await runAurumAgent(userText, chatId);

  // Voice vs Text Decision (Spec §5):
  // Quick simple price checks can be text, but if it has historical MA context or the user asked via voice/audio, send voice note.
  const hasHistoricalContext =
    agentResponse.toolsCalled.includes("get_market_snapshot") ||
    userText.toLowerCase().includes("bhav") ||
    userText.toLowerCase().includes("rate") ||
    userText.toLowerCase().includes("sochna");

  let voiceSent = false;
  if (hasHistoricalContext) {
    // Generate voice note via Edge-TTS + FFmpeg libopus (RULE-006)
    const voiceResult = await generateOggVoiceNote(agentResponse.text);
    if (voiceResult) {
      try {
        voiceSent = await sendTelegramVoiceNote(
          chatId,
          voiceResult.oggPath,
          agentResponse.text
        );
      } finally {
        // RULE-021: Ephemeral lifecycle - delete audio file after sending
        voiceResult.cleanup();
      }
    }
  }

  // RULE-011: If voice was not sent (or TTS failed), fall back to text message
  if (!voiceSent) {
    await sendTelegramTextMessage(chatId, agentResponse.text, false);
    await logInteraction(
      chatId,
      "outgoing_text",
      agentResponse.text,
      agentResponse.modelUsed,
      false
    );
  } else {
    await logInteraction(
      chatId,
      "outgoing_voice",
      agentResponse.text,
      agentResponse.modelUsed,
      true
    );
  }
}
