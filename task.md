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
- [x] Explicit human confirmation received and live public production deployment complete
- [x] Native/fluent Hindi speaker tone check complete with polished conversational copy (`RULE-018`)

## Phase 8 — Full-Stack Command Center (Obsidian-Gold Design System)
- [x] Luxury glassmorphic dark UI with Outfit, Inter, and JetBrains Mono fonts (`app/globals.css`, `app/layout.tsx`)
- [x] Live bullion tickers (24K, 22K, Silver) with moving average benchmark deviation tags (MA7, MA15, MA30)
- [x] Interactive SVG price trajectory chart with toggleable moving average overlays
- [x] Pure deterministic Affordability Calculator (Grams, Tolas, Pavans, Troy Ounces + 15% Duty + 3% GST breakdown per `RULE-001`)
- [x] International Spot vs Domestic Landed Arbitrage Explorer (COMEX -> FX -> Duty -> GST)
- [x] Interactive Target Alert Creator & Simulator (`app/api/alerts/create/route.ts`)
- [x] Web conversation sandbox & in-browser Hindi audio preview
- [x] Instantaneous first paint with institutional anchor defaults; zero blank loading flashes
- [x] Verified via Next.js App Router production build: `npm run build` completed with 0 errors across 6 static/dynamic routes
- [x] Live on Vercel: `https://aurumai-opal.vercel.app`

## Phase 9 — Multi-Asset Data Mining & Econometric EDA
- [x] Multi-asset data mining pipeline (`ml_pipeline/data_engineering/multi_asset_miner.py`) ingesting Gold (`GC=F`), Silver (`SI=F`), USD/INR (`INR=X`), Crude Oil (`CL=F`), US 10Y Yields (`^TNX`) (782 trading days, 20 clean columns)
- [x] 38-factor quantitative feature engineering matrix (`ml_pipeline/data_engineering/feature_engineer.py`)
- [x] Augmented Dickey-Fuller (ADF) stationarity profiling: Proved raw gold price contains unit root (non-stationary, $t = -1.157$, $p > 0.10$) while daily log returns are stationary ($t = -25.696$, $p < 0.001$)
- [x] Return distribution analysis: Documented high kurtosis of 6.293 (fat-tailed jump risk) and negative skewness (-1.062)
- [x] Predictive linear correlation scan: Confirmed weak correlation ($|r| < 0.18$) between technical factors and 5-day forward return

## Phase 10 — Advanced ML Benchmark, Untouched Holdout & Physical Transaction Costs
- [x] Walk-forward evaluation across 4 model families: Naive Majority, Regularized Logistic L2, Random Forest, HistGradientBoosting
- [x] Selection-bias demonstration: Reference pipeline (`ml_pipeline/trend_signal_research_pipeline.py`) proved in-sample winning models overfit and collapse on untouched holdouts (-5.33% edge)
- [x] Real market data evaluation (`ml_pipeline/evaluate_real_holdout.py`): Models achieved 51.19% on final untouched holdout vs 59.52% naive baseline (-8.33% edge deficit)
- [x] Physical bullion transaction cost modeling (4% round-trip friction): Strategy produces deeply negative annualized Sharpe ratio (-4.63)
- [x] `RULE-016` & `RULE-017` physical invariant gating: Rejection of directional predictions; `trend_signal_validated` strictly locked to `FALSE`
- [x] Automated weekly retraining and invariant testing CI/CD workflow (`.github/workflows/ml_pipeline_eval.yml`)

## Phase 11 — Red Team Privacy & Security Audit
- [x] VULN-01 (IDOR on `/api/alerts/create`): Whitelisted sandbox IDs, isolated unauthenticated requests to simulation mode, closed account hijacking
- [x] VULN-02 (Timing Attacks): Implemented constant-time cryptographic buffer comparisons (`crypto.timingSafeEqual`) for webhook and cron secret tokens
- [x] VULN-03 (HTTP Security Headers): Injected strict `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, and `Referrer-Policy` in `next.config.mjs`
- [x] VULN-04 (In-Memory Heap DoS): Added active key-reclamation and bounded LRU storage (`MAX_TRACKED_IDENTIFIERS = 5000`) in `agent/utils/rate_limit.ts`
- [x] VULN-05 (Prompt Injection): Capped user inputs at 500 characters and encapsulated within `<user_query>` XML boundaries
- [x] VULN-06 (Alert API Flooding): Added sliding-window IP rate limiting (10 req/min) on `/api/alerts/create`
- [x] VULN-07 (PII Sanitization): Scrubbed all hardcoded test chat IDs and database references from test scripts and documentation
- [x] Verified via dedicated automated Red Team test suite (`tests/test_red_team_audit.mjs`): 12/12 tests passed
- [x] Total automated test suite: 18 Python tests + 28 TypeScript/Red Team tests = 46/46 passed (100%)

## Phase 12 — Daily Morning Digest & Operational Reliability
- [x] Configured Vercel Cron via `vercel.json` (`30 3 * * *`, 09:00 AM IST daily morning digest per Spec §8)
- [x] Implemented `/api/cron/daily-digest` with timing-safe `CRON_SECRET` validation (CWE-208)
- [x] Cultural morning greeting with landed price and 15-day MA contextual comparison (Spec §2)
- [x] Spec §7: 90-day retention cleanup for `chat_log` running during daily digest execution
- [x] Auto-enrollment of users in `users` table on `/start` command for automated delivery
- [x] Fixed step-level secret conditional evaluation in `.github/workflows/hourly_fetch.yml`
- [x] Automated test suite: `tests/test_daily_digest.mjs` (2/2 tests passed)
- [x] Total automated test suite: 18 Python tests + 30 TypeScript tests = **48/48 passed (100%)**

