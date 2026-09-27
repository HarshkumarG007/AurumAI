"""
Aurum AI - Voice Synthesis and FFmpeg libopus Encoding
Complies with Aurum_AI_Specification.md §3, RULE-006, RULE-011, and RULE-021.
"""

import sys
import os
import asyncio
import subprocess
import tempfile
from pathlib import Path
import edge_tts

DEFAULT_VOICE = os.getenv("DEFAULT_TTS_VOICE", "hi-IN-SwaraNeural")


async def text_to_ogg_opus(text: str, voice: str = DEFAULT_VOICE, output_path: str = None) -> str:
    """
    Synthesizes speech using edge-tts (MP3), then converts using FFmpeg into
    an OGG container with Opus codec (48kHz, mono, 24kbps) for native Telegram sendVoice rendering.
    Enforces ephemeral lifecycle: returns path to ogg, caller is responsible for deleting (RULE-021).
    """
    # Create temporary files
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as mp3_file:
        mp3_path = mp3_file.name

    if output_path is None:
        ogg_file = tempfile.NamedTemporaryFile(suffix=".ogg", delete=False)
        ogg_path = ogg_file.name
        ogg_file.close()
    else:
        ogg_path = output_path

    try:
        # Step 1: Synthesize MP3 via Edge-TTS
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(mp3_path)

        # Step 2: Convert to OGG Opus via FFmpeg (RULE-006)
        # ffmpeg -y -i input.mp3 -c:a libopus -b:a 24k -ar 48000 -ac 1 output.ogg
        cmd = [
            "ffmpeg",
            "-y",
            "-i", mp3_path,
            "-c:a", "libopus",
            "-b:a", "24k",
            "-ar", "48000",
            "-ac", "1",
            ogg_path
        ]
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return ogg_path

    finally:
        # Cleanup intermediate MP3 immediately (RULE-021)
        if os.path.exists(mp3_path):
            try:
                os.remove(mp3_path)
            except OSError:
                pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tts_convert.py <text> [output_file.ogg]")
        sys.exit(1)
    
    text_input = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "output.ogg"
    
    res = asyncio.run(text_to_ogg_opus(text_input, output_path=out))
    print(f"Generated OGG Opus audio: {res}")
