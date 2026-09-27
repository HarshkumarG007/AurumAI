"""
Aurum AI - Live Telegram Voice Note Dispatcher & Verifier
Tests sending an actual native OGG Opus voice note to a real Telegram chat.
"""

import os
import sys
import asyncio
import requests
from pathlib import Path
from dotenv import load_dotenv

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml_pipeline.tts_convert import text_to_ogg_opus

load_dotenv()


def send_voice_to_telegram(bot_token: str, chat_id: str, ogg_path: str, caption: str = "") -> dict:
    url = f"https://api.telegram.org/bot{bot_token}/sendVoice"
    with open(ogg_path, "rb") as f:
        files = {"voice": ("voice.ogg", f, "audio/ogg")}
        data = {"chat_id": chat_id, "caption": caption}
        res = requests.post(url, data=data, files=files, timeout=30)
    return res.json()


async def main():
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = sys.argv[1] if len(sys.argv) > 1 else os.getenv("TELEGRAM_TEST_CHAT_ID")

    if not bot_token or "123456789:" in bot_token or not chat_id:
        print("[INFO] Live Telegram testing requires TELEGRAM_BOT_TOKEN and a chat_id.")
        print("Usage: python scripts/test_live_telegram_voice.py <YOUR_CHAT_ID>")
        sys.exit(0)

    sample_text = (
        "Namaste! Aaj 24K gold ka bhav pichle pandrah din ke average se thoda kam hai. "
        "Yeh anumaanit keemat hai — sthaniya dukaandaar se alag ho sakti hai. Yeh salaah nahi hai."
    )

    print("Generating OGG Opus voice note with Edge-TTS and FFmpeg...")
    ogg_file = await text_to_ogg_opus(sample_text)

    try:
        print(f"Sending voice note to Telegram Chat ID {chat_id}...")
        resp = send_voice_to_telegram(bot_token, chat_id, ogg_file, caption="Aurum AI Voice Test")
        print("Telegram API Response:", resp)
        if resp.get("ok"):
            voice_info = resp.get("result", {}).get("voice", {})
            print("\n[SUCCESS] Native Voice Note Delivered Successfully!")
            print(f"Message ID: {resp['result']['message_id']}")
            print(f"Duration: {voice_info.get('duration')}s")
            print(f"MIME type: {voice_info.get('mime_type')}")
        else:
            print("[ERROR] Telegram sendVoice failed:", resp.get("description"))
    finally:
        if os.path.exists(ogg_file):
            os.remove(ogg_file)


if __name__ == "__main__":
    asyncio.run(main())
