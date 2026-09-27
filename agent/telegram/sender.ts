/**
 * Aurum AI - Telegram Message & Voice Dispatcher
 * Complies with RULE-006 (sendVoice with libopus OGG) and RULE-012 (disclaimer on prices).
 */

import fs from "fs";
import { escapeMarkdownV2 } from "@/agent/utils/markdown";
import { ensureDisclaimer } from "@/agent/utils/disclaimer";
import { createClient } from "@supabase/supabase-js";

function getBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

/**
 * Sends a text message to a Telegram chat.
 * Tries MarkdownV2 first; falls back to plain text if parsing fails.
 */
export async function sendTelegramTextMessage(
  chatId: number | string,
  text: string,
  forceDisclaimer: boolean = false
): Promise<boolean> {
  const token = getBotToken();
  if (!token || token.includes("123456789:")) {
    console.log(`[MOCK TELEGRAM TEXT] To ${chatId}: ${text}`);
    return true;
  }

  const processedText = ensureDisclaimer(text, forceDisclaimer);
  const escapedText = escapeMarkdownV2(processedText);

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: escapedText,
        parse_mode: "MarkdownV2",
      }),
    });

    if (!res.ok) {
      // If MarkdownV2 failed, fallback to plain text unformatted
      console.warn("MarkdownV2 send failed, falling back to plain text...");
      const plainRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: processedText,
        }),
      });
      return plainRes.ok;
    }

    return true;
  } catch (err) {
    console.error("Failed to send Telegram text message:", err);
    return false;
  }
}

/**
 * Sends a native voice note to Telegram using sendVoice.
 * Requires an OGG container with Opus codec (RULE-006).
 */
export async function sendTelegramVoiceNote(
  chatId: number | string,
  oggFilePath: string,
  captionText?: string
): Promise<boolean> {
  const token = getBotToken();
  if (!token || token.includes("123456789:")) {
    console.log(`[MOCK TELEGRAM VOICE] To ${chatId} with file ${oggFilePath}`);
    return true;
  }

  const url = `https://api.telegram.org/bot${token}/sendVoice`;

  try {
    const fileBuffer = fs.readFileSync(oggFilePath);
    const blob = new Blob([fileBuffer], { type: "audio/ogg" });
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    formData.append("voice", blob, "voice.ogg");

    if (captionText) {
      const caption = ensureDisclaimer(captionText, false);
      formData.append("caption", caption.substring(0, 1024));
    }

    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (!json.ok) {
      console.error("Telegram sendVoice API returned error:", json);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to send Telegram voice note:", err);
    return false;
  }
}

/**
 * Logs interaction to Supabase chat_log table per spec §7.
 */
export async function logInteraction(
  chatId: number | string,
  messageType: "incoming_text" | "incoming_voice" | "outgoing_text" | "outgoing_voice",
  content: string,
  modelUsed?: string,
  usedTts: boolean = false
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project")) return;

  try {
    const supabase = createClient(url, key);
    await supabase.from("chat_log").insert({
      chat_id: Number(chatId),
      message_type: messageType,
      content,
      model_used: modelUsed || null,
      used_tts: usedTts,
    });
  } catch (err) {
    console.warn("Failed to log interaction to Supabase:", err);
  }
}
