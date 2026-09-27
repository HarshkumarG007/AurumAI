/**
 * Aurum AI - Voice Pipeline (TypeScript Wrapper)
 * Complies with RULE-006, RULE-011, and RULE-021.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export async function generateOggVoiceNote(
  text: string,
  voice: string = process.env.DEFAULT_TTS_VOICE || "hi-IN-SwaraNeural"
): Promise<{ oggPath: string; cleanup: () => void } | null> {
  const tempOgg = path.join(
    os.tmpdir(),
    `aurum_voice_${Date.now()}_${Math.random().toString(36).substring(7)}.ogg`
  );

  return new Promise((resolve) => {
    // Run ml_pipeline/tts_convert.py
    const scriptPath = path.resolve(process.cwd(), "ml_pipeline", "tts_convert.py");
    const py = spawn("python", [scriptPath, text, tempOgg]);

    let stderr = "";
    py.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    py.on("close", (code) => {
      if (code === 0 && fs.existsSync(tempOgg)) {
        resolve({
          oggPath: tempOgg,
          cleanup: () => {
            try {
              if (fs.existsSync(tempOgg)) {
                fs.unlinkSync(tempOgg); // RULE-021: Ephemeral lifecycle
              }
            } catch (err) {
              console.warn("Failed to cleanup temp ogg:", err);
            }
          },
        });
      } else {
        console.warn("TTS/FFmpeg generation failed (code:", code, "):", stderr);
        // Fallback to null per RULE-011 (caller falls back to text)
        resolve(null);
      }
    });

    py.on("error", (err) => {
      console.warn("Failed to spawn python for TTS:", err);
      resolve(null);
    });
  });
}
