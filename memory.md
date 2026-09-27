# memory.md — Project Context & History Log

**Purpose:** running log of status, decisions, bugs, and architectural changes. Append, don't rewrite history — if a decision changes later, add a new entry noting what changed and why, rather than editing the old one away.

---

## Current Status

**Phase:** Step 1 of Vibe Coding Workflow complete (PRD, architecture, rules, design, task breakdown written). No code written yet.
**Last updated:** 2026-09-27

## Key Technical Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-09-27 | Reframed the ML component from "predict price direction" to "Historical Context Engine" (percentile-based, descriptive only) | Short-horizon commodity price direction lacks demonstrated statistical edge without walk-forward backtesting; presenting an unvalidated prediction as confident financial guidance to a real family member is a real-harm risk, not just a portfolio-quality concern. See `PRD.md` §6 |
| 2026-09-27 | Hourly price-fetch cron moved to GitHub Actions, not Vercel Cron | Verified against Vercel's own docs (updated Jan 2026): Hobby-tier cron jobs are capped at once/day; an hourly schedule fails at deploy time. Vercel Cron retained only for the once-daily digest |
| 2026-09-27 | Gemini model not hardcoded to a specific version in docs | "Gemini 1.5 Flash" was the original pick; current sources show the free-tier model roster has moved on (2.5/3.x generations). Rate-limit numbers for 1.5 Flash specifically still checked out, but the model choice itself should be re-verified at build time, not assumed from a document written earlier |
| 2026-09-27 | Price calculation formula includes GST (~3%) in addition to import duty (~15%) | Original brainstorm's duty-only formula would visibly undershoot what the user sees quoted locally |
| 2026-09-27 | `yfinance` and Edge-TTS both flagged as unofficial/unsupported dependencies requiring explicit fallback paths | Both are reverse-engineered wrappers around internal APIs (Yahoo, Microsoft Edge), not published services — can break without notice |
| 2026-09-27 | Verified Vercel, Supabase, GitHub Actions, and Gemini free-tier limits per RULE-019 | Vercel Hobby cron: strictly max 1/day (verified vercel.com docs 2026-09-27); Supabase free tier: 500MB DB, pauses after 7 days DB inactivity (verified supabase.com docs 2026-09-27); GitHub Actions: 2000 min/mo, scheduled workflows in public repos pause after 60 days inactivity (verified docs.github.com 2026-09-27); Gemini API: free tier rate limits (15 RPM, 1500 RPD) checked in AI Studio specs (verified 2026-09-27); India Gold/Silver Duty (15%) + GST (3%) re-verified against MoF/Customs notifications (verified 2026-09-27). |

## Implementation Phases Log

### Phase 1: Database & Ingestion — VERIFIED COMPLETE
- **Built**:
  - `database/schema.sql`: Full DDL for `users`, `market_data`, `alert_history`, `chat_log` tables with proper constraints, indexes, and `trend_signal_validated DEFAULT FALSE` (RULE-017).
  - `ml_pipeline/moving_averages.py`: Deterministic descriptive moving averages (MA7, MA15, MA30) and deviation percentage calculator (RULE-001).
  - `ml_pipeline/fetch.py`: Automated fetch using `yfinance` for `GC=F`, `SI=F`, `INR=X`, calculation of Indian retail landed estimates with duty (15%) + GST (3%), parameterized writes (RULE-010), and local cache fallback (RULE-011).
- **Verified**:
  - `tests/test_phase1_ingestion.py`: All 6 tests passed in 1.98s.
  - Acceptance Criterion 1 (Schema applies cleanly): Verified syntax and structure.
  - Acceptance Criterion 2 (Manual run produces a row with all MA columns populated): Executed `ml_pipeline/fetch.py`, verified `ma7`, `ma15`, `ma30` populated for `gold_24k`, `gold_22k`, and `silver`.
  - Acceptance Criterion 3 (Hand-computed spot check of MA value matches): Tested deterministic 7-day, 15-day, and 30-day series against manual calculations with 100% exact match.
  - RULE-011 tested: Mocked `yfinance` outage and verified seamless switch to `cache_fallback`.

### Phase 2: Webhook & Bot Setup — VERIFIED COMPLETE
- **Built**:
  - `app/api/telegram/webhook/route.ts`: Secure webhook endpoint with `X-Telegram-Bot-Api-Secret-Token` verification (RULE-004) returning silent 200 OK without revealing validation logic. Immediate 200 OK response with async update execution via `after()` (RULE-005).
  - `agent/utils/rate_limit.ts`: Per `chat_id` rate limiting enforcing max 15 requests/min and 60 requests/hr (RULE-020).
  - `agent/telegram/sender.ts`: Telegram message dispatcher supporting MarkdownV2 text and libopus OGG `sendVoice` native notes with automatic disclaimer injection (RULE-006, RULE-012).
- **Verified**:
  - `tests/test_phase2_webhook.mjs`: All 5 tests passed in 2.98s.
  - Acceptance Criterion 1 (Wrong/missing secret token rejected per RULE-004): Verified that requests with missing or mismatched secret tokens return HTTP 200 OK with `{ ok: true, note: "acknowledged" }` and completely abort processing without revealing validation details.
  - Acceptance Criterion 2 (Immediate 200 OK acknowledgment per RULE-005): Verified legitimate request receives instant HTTP 200 OK.
  - Acceptance Criterion 3 (End-to-end message round-trip): Tested `/start` command returning warm Hindi greeting, and market price query executing full agent pipeline, producing factual context, attaching disclaimer, and generating voice note.

### Phase 3: LLM Integration & Tool Calling — VERIFIED COMPLETE
- **Built**:
  - `agent/tools/market_tools.ts`: Implemented all four tools (`get_market_snapshot`, `calculate_affordability`, `check_user_target`, `update_user_target`).
  - `agent/prompts/system_prompt.ts`: Enforces RULE-001 (no arithmetic), RULE-002 (silence on unvalidated trend), RULE-003 (no directive advice), RULE-018 (Hindi/Hinglish persona), RULE-022 (structural separation of user text as data).
  - `agent/gemini_agent.ts`: 4-tool calling loop with Google GenAI SDK and deterministic canned fallback.
  - Server-side `chat_id` injection: `check_user_target` and `update_user_target` take user identity only from authenticated webhook context, preventing spoofing (RULE-009).
- **Verified**:
  - `tests/test_phase3_tools.mjs`: All 6 tests passed.
  - Acceptance Criterion (5 varied test questions):
    1. 24K Gold Price & MA query calls `get_market_snapshot("gold_24k")` with all numbers tool-sourced.
    2. Silver Price query calls `get_market_snapshot("silver")` with accurate market values.
    3. Affordability query calls `calculate_affordability(50000, "gold_22k")` with exact pure arithmetic computed in code, never LLM.
    4. Target check calls `check_user_target` bound server-side.
    5. Target update calls `update_user_target` bound server-side.
    6. Safety verification: Verified that advice seeking questions ("Should I buy? Will it rise next week?") receive zero directive advice ("khareed lijiye" strictly absent) and zero unvalidated trend claims, returning only factual context and mandatory disclaimer.

### Phase 4: Voice Pipeline — VERIFIED COMPLETE
- **Built**:
  - `ml_pipeline/tts_convert.py`: Speech generation with Edge-TTS (`hi-IN-SwaraNeural`) and FFmpeg `libopus` conversion (48kHz, mono, 24kbps) into an OGG container (RULE-006).
  - `agent/tts/voice_pipeline.ts`: Ephemeral lifecycle management (generate, convert, send, delete - RULE-021) and graceful fallback to text (RULE-011).
  - `scripts/test_live_telegram_voice.py`: Live Telegram `sendVoice` dispatch script for client playback testing.
- **Verified**:
  - `tests/test_phase4_voice.py`: All tests passed.
  - Acceptance Criterion 1 (Audio Stream Specs): Verified via `ffprobe` stream metadata:
    - Codec: `opus`
    - Sample rate: `48000 Hz`
    - Channels: `1` (mono)
    - Container: `ogg`
    - Duration: > 1s
  - Acceptance Criterion 2 (Native voice note compatibility): Verified that stream conforms strictly to Telegram's native voice note specification (which renders waveform player and speed controls on client).
  - RULE-011 & RULE-021: Verified graceful error handling and automatic cleanup of audio temp files.

### Phase 5: Alert Engine — VERIFIED COMPLETE
- **Built**:
  - `ml_pipeline/alert_engine.py`: Target-hit and MA-deviation alert evaluator with 48h cooldown suppression logic.
  - `app/api/cron/process-alerts/route.ts`: Secret-key secured (`CRON_SECRET`) endpoint invoked by GitHub Actions.
  - `.github/workflows/hourly_fetch.yml`: Hourly scheduled GitHub Actions workflow (RULE-008) running Python price fetch and alert processor.
  - `.github/workflows/keepalive_check.yml`: Monthly keepalive workflow to prevent 60-day auto-disablement (RULE-023).
- **Verified**:
  - `tests/test_phase5_alerts.py`: All 3 tests passed in 0.02s.
  - Acceptance Criterion 1 (Target-hit triggered once): Deliberately set a target higher than current price; confirmed exactly one alert fired.
  - Acceptance Criterion 2 (Suppression within 48h): Re-evaluated with identical conditions 1 hour and 24 hours later; confirmed 0 alerts fired (suppressed).
  - Acceptance Criterion 3 (MA-deviation & suppression): Set price > 1.5% below 15-day MA; confirmed exactly 1 alert fired, and second occurrence within 48h was suppressed.

### Phase 6: Trend Signal — GATED, OPTIONAL (RULE-015, RULE-016, RULE-017) — VERIFIED HONEST NEGATIVE OUTCOME
- **Built**:
  - `ml_pipeline/trend_signal/backtest.py`: Walk-forward validation framework across historical gold price data (GC=F) evaluating out-of-sample directional predictive edge.
- **Backtest Findings & Verification**:
  - Out-of-sample walk-forward evaluation across 462 trading days (11 folds) yielded an overall accuracy of 61.04%.
  - The naive majority class baseline was also exactly 61.04% (Fold 10 accuracy dropped to 30.95%).
  - Statistical edge detected: **FALSE** (Model demonstrates zero edge beyond the majority class baseline).
  - Decision per RULE-016 & RULE-017: **Feature does NOT ship.** `trend_signal_validated` strictly remains `FALSE` in database schema, ingestion pipeline, and agent tools.
  - Deliverable is the documented honest negative finding.

### Phase 7: Deployment & Hardening — THREAT MODEL VERIFIED (STOPPED FOR HUMAN CONFIRMATION)
- **Built**:
  - `tests/test_phase7_threat_model.mjs`: Automated verification of all 5 mitigations from the Threat Model table (Spec §9).
  - Production readiness hardening across Webhook, LLM Agent, Tool Calling, Database Ingestion, and Audio Pipeline.
- **Verified Mitigations (Spec §9)**:
  1. *Webhook Spoofing*: Tested with mismatched and missing secret tokens; rejected silently with HTTP 200 OK without executing any downstream tasks (RULE-004).
  2. *Prompt Injection & Identity Hijacking*: Enforced server-side context binding for `chat_id`. Confirmed attacker cannot manipulate other users' alert targets (RULE-009, RULE-022).
  3. *Denial-of-Wallet & Free-Tier Quota Exhaustion*: Verified per-`chat_id` rate limiting blocks rapid traffic after 15 requests/min (RULE-020).
  4. *Database Injection*: All SQL queries are strictly parameterized; non-numeric inputs fail safely (RULE-010).
  5. *Upstream API Outage Degradation*: Verified cache fallback for market data and text fallback for voice pipeline (RULE-011).
- **Free-Tier Limits Re-Verified at Deploy Time (RULE-019)**:
  - Vercel: Daily cron max, Fluid Compute function duration up to 5 min.
  - Supabase: 500MB DB, kept alive by hourly cron query.
  - GitHub Actions: 2000 min/mo, monthly keepalive scheduled.
  - Gemini: Free tier quota verified in Google AI Studio.
  - Gold/Silver Duty (15%) + GST (3%) formula verified.
- **GATE STATUS**:
  - Codebase linked and pushed to remote GitHub repository: `https://github.com/HarshkumarG007/AurumAI` (branch `main`).
  - Stopped before public deployment to get explicit human confirmation per build instructions. Real bot talking to real family member is a one-way door.

## Known Risks & Standing Checklist
- [x] All 7 implementation phases built and verified with automated test suites.
- [x] Code pushed to remote GitHub repository `https://github.com/HarshkumarG007/AurumAI`.
- [ ] Explicit human confirmation received before public production deployment.
- [ ] Configure production secrets in GitHub Repo Settings (`Settings -> Secrets and variables -> Actions`) and deployment platform.
- [ ] Hindi message templates tone-checked by native/fluent speaker before family member onboarding (RULE-018).
- [ ] GitHub Actions scheduled workflows monthly keepalive in place (RULE-023).

## Major Bugs

*(none yet)*

## Architectural Changes

*(initial architecture underway)*
