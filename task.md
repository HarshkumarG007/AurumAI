# task.md — Task Breakdown

**Version:** 2.0 — 2026-09-27
**Status:** All Implementation Phases 1-7 Built & Verified; Production Deployment Awaiting Human Gate

---

## Phase 0 — Setup
- [x] Confirm current best free, non-preview Gemini model in Google AI Studio; record model name + rate limits + verification date in `memory.md` (Gemini Flash free tier verified 2026-09-27: 15 RPM, 1500 RPD)
- [x] Telegram bot configuration via environment variables (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`)
- [x] Supabase project configuration; applied schema from `database/schema.sql`
- [x] GitHub repo with Actions enabled (`hourly_fetch.yml`, `keepalive_check.yml`)

## Phase 1 — Price Fetch Pipeline
- [x] Write fetch script: `yfinance` pull for `GC=F`, `SI=F`, `INR=X` (`ml_pipeline/fetch.py`)
- [x] Implement price calculator (spot × fx × (1 + duty (15%) + GST (3%))); verified 1.18 multiplier
- [x] Write to `market_data` table with parameterized SQL (`RULE-010`)
- [x] Implement last-known-good cache fallback (`ml_pipeline/cache.json`) for when `yfinance` fails (`RULE-011`)
- [x] Wire the fetch script into GitHub Actions hourly schedule (`.github/workflows/hourly_fetch.yml`)
- [x] Verified via `tests/test_phase1_ingestion.py` (6/6 tests passed)

## Phase 2 — Historical Context Engine
- [x] Implement MA7, MA15, MA30 and deviation calculations (`ml_pipeline/moving_averages.py`)
- [x] Hand-compute expected moving averages for synthetic 7-day, 15-day, 30-day sequences; verified exact cent match
- [x] Confirm output is a factual, non-predictive comparison statement

## Phase 3 — Telegram Webhook + Agent
- [x] Set up webhook handler in Next.js App Router (`app/api/telegram/webhook/route.ts`)
- [x] Webhook secret token validation returning silent 200 OK on mismatch (`RULE-004`)
- [x] Instant 200 OK acknowledgment with background async execution via `after()` (`RULE-005`)
- [x] Per-chat sliding window rate limiter: 15 req/min, 60 req/hr (`RULE-020`)
- [x] Gemini Flash agent integration with 4 deterministic tools (`agent/gemini_agent.ts`, `agent/tools/market_tools.ts`)
- [x] Server-side `chat_id` isolation: LLM cannot query or modify other users' targets (`RULE-009`)
- [x] Canned-template deterministic fallback when Gemini API key missing/rate-limited
- [x] Response Formatter that appends mandatory disclaimer in 100% of price outputs (`agent/utils/disclaimer.ts`, `RULE-012`)
- [x] Verified via `tests/test_phase2_webhook.mjs` and `tests/test_phase3_tools.mjs`

## Phase 4 — Voice
- [x] Wire Edge-TTS with `hi-IN-SwaraNeural` (`ml_pipeline/tts_convert.py`)
- [x] Transcode to Telegram native voice note format via FFmpeg: libopus, 48kHz, mono, 24kbps in OGG container (`RULE-006`)
- [x] Implement text fallback when TTS/FFmpeg raises an exception (`RULE-011`)
- [x] Enforce ephemeral audio lifecycle: delete audio files immediately after dispatch (`RULE-021`)
- [x] Verified via `tests/test_phase4_voice.py` and `scripts/test_live_telegram_voice.py`

## Phase 5 — Alerts + State Machine
- [x] Implement alert checking logic inside hourly fetch job (`ml_pipeline/alert_engine.py`)
- [x] Target-hit crossing detection with 48h suppression
- [x] MA-deviation trigger (>1.5% drop below 15-day MA) with 48h suppression
- [x] Secure internal cron endpoint (`app/api/cron/process-alerts/route.ts`)
- [x] Verified via `tests/test_phase5_alerts.py` (3/3 tests passed)

## Phase 6 — Trend Prediction Gating (Honest Negative Result)
- [x] Walk-forward backtest framework across 462 trading days / 11 folds (`ml_pipeline/trend_signal/backtest.py`)
- [x] Honest out-of-sample reporting: 61.04% model accuracy equals 61.04% majority baseline (0.00% edge)
- [x] Enforce `RULE-016` & `RULE-017`: Feature does NOT ship; `trend_signal_validated` strictly remains `FALSE`
- [x] Verified via `tests/test_phase6_gating.py` (3/3 tests passed)

## Phase 7 — Wrap-up & Deployment Hardening
- [x] Confirm zero recurring cost across all services (Vercel, Supabase, GitHub Actions, Google AI Studio) (`RULE-007`)
- [x] Automated threat model test suite covering all 5 attack vectors (`tests/test_phase7_threat_model.mjs`)
- [x] Monthly keepalive workflow to prevent 60-day GitHub Actions auto-disablement (`.github/workflows/keepalive_check.yml`, `RULE-023`)
- [x] Final review of every message template and prompt for strict non-directive language (`RULE-003`, `RULE-022`)
- [x] Repository pushed to remote `origin/main` (`https://github.com/HarshkumarG007/AurumAI`)
- [ ] Explicit human confirmation before live public production deployment
- [ ] Native/fluent Hindi speaker tone check before onboarding real family member (`RULE-018`)
