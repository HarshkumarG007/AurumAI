# Aurum AI (औरम एआई)

> **"Har din ka sona-chandi update, apni bhasha mein."**  
> A Telegram companion that provides gold and silver landed prices and historical moving average context in spoken Hindi, without ever issuing financial advice or directive instructions.

---

## 1. Safety & Engineering Principles

Aurum AI is built with strict safety boundaries because its voice is read aloud to real people who make real financial choices:
- **RULE-001 (Zero LLM Financial Arithmetic):** The LLM never computes averages or affordability. Backend tools compute all numbers; the LLM merely structures the wording.
- **RULE-002 & RULE-017 (Deterministic Context vs. Trend Gating):** Moving averages (MA7, MA15, MA30) provide factual historical context. Predictive trend signals default to `trend_signal_validated: FALSE` and remain strictly silent unless proven by walk-forward backtesting.
- **RULE-003 (Strictly Non-Directive Persona):** Even if asked directly *"Kya mujhe aaj sona khareedna chahiye?"*, the bot explicitly declines advice and reports purely factual market data.
- **RULE-004 (Silent Webhook Auth):** Requests with mismatched or missing secret tokens return `200 OK` silently, without revealing validation logic.
- **RULE-006 (Native Telegram Voice Notes):** Audio is synthesized via Edge-TTS (`hi-IN-SwaraNeural`) and encoded with FFmpeg `libopus` into an OGG container (48kHz, mono, 24kbps), ensuring it renders as a native voice note on Telegram clients.
- **RULE-009 (Server-Side Identity Binding):** User-specific tools (`check_user_target`, `update_user_target`) bind `chat_id` strictly from server-side webhook authentication, eliminating prompt-injection spoofing.
- **RULE-012 (Mandatory Disclaimer):** Every price-related message includes:
  > _"Yeh anumaanit keemat hai — sthaniya dukaandaar se alag ho sakti hai. Yeh salaah nahi hai."_
- **RULE-021 (Ephemeral Audio Lifecycle):** Voice notes are generated, converted, sent, and immediately deleted. Zero audio is stored persistently.

---

## 2. Architecture & Tech Stack

| Layer | Component | Notes |
|---|---|---|
| **Webhook & API** | Next.js App Router (TypeScript) | Immediate 200 OK response with async processing via `after()` |
| **Ingestion Cron** | Python 3.13 on GitHub Actions | Scheduled hourly (`0 * * * *`), computing MA7/15/30 |
| **Database** | Supabase Postgres (Free Tier) | Hourly ping keeps DB awake; parameterized SQL only |
| **LLM Agent** | Google Gemini Flash | System prompt structurally separates user text from instructions |
| **Voice Synthesis** | Edge-TTS + FFmpeg | `hi-IN-SwaraNeural` -> FFmpeg libopus -> Telegram `sendVoice` |

---

## 3. Repository Structure

```
aurum-ai/
├── app/
│   └── api/
│       ├── telegram/webhook/route.ts      # Webhook route with secret token verification
│       └── cron/process-alerts/route.ts   # Secret-key secured alert trigger
├── agent/
│   ├── prompts/system_prompt.ts           # Persona and hard safety constraints
│   ├── tools/market_tools.ts              # get_market_snapshot, calculate_affordability, targets
│   ├── tts/voice_pipeline.ts              # FFmpeg libopus conversion & ephemeral cleanup
│   ├── telegram/sender.ts                 # MarkdownV2 and sendVoice dispatcher
│   ├── utils/
│   │   ├── disclaimer.ts                  # Mandatory disclaimer injector (RULE-012)
│   │   ├── markdown.ts                    # Telegram MarkdownV2 reserved-character escaper
│   │   └── rate_limit.ts                  # Per chat_id rate limiter (RULE-020)
│   └── gemini_agent.ts                    # 4-tool calling loop & deterministic fallback
├── database/
│   └── schema.sql                         # PostgreSQL schema with constraints & defaults
├── ml_pipeline/
│   ├── fetch.py                           # yfinance market fetch + MA calculation
│   ├── moving_averages.py                 # Deterministic descriptive moving averages
│   ├── alert_engine.py                    # Target hit & MA deviation engine with 48h suppression
│   ├── tts_convert.py                     # Edge-TTS + FFmpeg libopus converter
│   └── trend_signal/
│       └── backtest.py                    # Walk-forward backtester for Phase 6 gating
├── .github/workflows/
│   ├── hourly_fetch.yml                   # Hourly GitHub Actions fetch cron
│   └── keepalive_check.yml                # Monthly keepalive preventing 60-day auto-disable
├── tests/                                 # Complete verification test suite for all phases
├── scripts/
│   └── test_live_telegram_voice.py        # Live Telegram sendVoice client test
├── memory.md                              # Decision & verification log
├── .env.example                           # Configuration blueprint
└── README.md
```

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js >= 20
- Python >= 3.11
- FFmpeg installed in system PATH

### Installation
```bash
# 1. Install Node dependencies
npm install

# 2. Install Python dependencies
pip install yfinance supabase psycopg2-binary python-dotenv edge-tts requests pytest scikit-learn
```

### Environment Configuration
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

---

## 5. Verification & Testing

Every phase has automated acceptance criteria test suites:

```bash
# Run all Python ingestion, voice, alert engine, and backtest tests:
python -m pytest tests/ -v

# Run all TypeScript webhook, tool calling, and threat model tests:
npx tsx --test tests/test_phase2_webhook.mjs tests/test_phase3_tools.mjs tests/test_phase7_threat_model.mjs

# Manual run of the price ingestion pipeline:
python ml_pipeline/fetch.py

# Walk-forward backtest report:
python ml_pipeline/trend_signal/backtest.py

# Test delivering a native voice note to your real Telegram app:
python scripts/test_live_telegram_voice.py <YOUR_TELEGRAM_CHAT_ID>
```
