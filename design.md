# design.md — Design System

**Version:** 1.0 — 2026-09-27
**A note on scope:** the standard template for this file asks for color palettes, typography, and UI components. Those don't apply here — Telegram's own client renders every chat bubble, and this project has no custom visual surface. What actually needs a design system for a voice-first Telegram bot is: tone of voice, message structure, number formatting, and audio design. That's what follows.

---

## 1. Core Design Principles

1. **Spoken-first, not read-first.** Every response should sound natural read aloud in Hindi before it's judged as text on a screen.
2. **Never confident about things it isn't confident about.** The bot's tone is warm and clear, but hedges genuinely uncertain or approximate information (see the mandatory disclaimer in `rules.md`) rather than smoothing over uncertainty for a nicer-sounding sentence.
3. **Short.** A voice note longer than ~20 seconds stops being a quick check-in and starts being a chore to listen to.

## 2. Voice Design

- **TTS voice:** `hi-IN-SwaraNeural` as the default, consistent voice for every response — a family member's ear will notice if the "assistant" sounds different each time.
- **Alternate voice:** `hi-IN-MadhurNeural` available as a settings toggle if the user prefers a male voice, but the default stays fixed once chosen.
- **Pacing:** default TTS rate; do not speed up to shorten audio — shorten the text instead.

## 3. Message Structure (the template every price response follows)

```
[Greeting/acknowledgement — 1 short line]
[The price, in Hindi, with ₹ symbol and Indian digit grouping]
[Historical context — 1 sentence, factual, not predictive]
[Disclaimer — short, every time]
```

Example (for review by a native Hindi speaker before shipping — not verified for tone here):
> Namaste! Aaj sone ka anumaanit bhaav ₹62,450 prati 10 gram hai. Yeh keemat pichle 30 dinon mein sabse kam keemat ke kareeb hai. Yeh anumaanit keemat hai, sthaniya dukaandaar se alag ho sakti hai — yeh salaah nahi hai.

## 4. Number Formatting Convention

- Currency always shown with ₹ and Indian digit grouping (e.g., `₹62,450`, not `₹62450` or `₹62,450.00`).
- Percentile/context statements use plain language ("sabse kam" / "sabse zyada" / "beech mein") rather than raw percentile numbers, which don't translate naturally into spoken Hindi.

## 5. Inline Keyboard Conventions

| Button | Emoji | Action |
|---|---|---|
| Check Gold | 📈 | Immediate gold price + context |
| Check Silver | 📉 | Immediate silver price + context |
| Set Alert | 🔔 | Starts the alert-setting conversation flow |

Keep the keyboard to 2–3 buttons max — more than that stops being a quick-glance UI and starts being a menu to study.

## 6. What to Avoid

- No emoji-stacking or decorative formatting inside the spoken portion of a message — it reads awkwardly when synthesized to voice.
- No English financial jargon mixed into Hindi sentences unless there is no natural Hindi equivalent (e.g., "MCX" itself is fine to keep as-is).
