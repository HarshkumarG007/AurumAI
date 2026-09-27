/**
 * Aurum AI - Telegram Update Handler
 * Processes incoming messages, rate limiting, and delegates to the Gemini Agent.
 */

import { runAurumAgent } from "@/agent/gemini_agent";
import { checkRateLimit } from "@/agent/utils/rate_limit";
import {
  sendTelegramTextMessage,
  sendTelegramVoiceNote,
  logInteraction,
} from "@/agent/telegram/sender";
import { generateOggVoiceNote } from "@/agent/tts/voice_pipeline";

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
