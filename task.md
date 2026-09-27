# task.md — Task Breakdown

**Version:** 1.0 — 2026-09-27
**How to use this:** work top to bottom. Each box is one atomic task. A task is only checked off once its own note (in parentheses) is genuinely true — not approximately true. Update `memory.md` after each phase.

---

## Phase 0 — Setup
- [ ] Confirm current best free, non-preview Gemini model in Google AI Studio; record model name + rate limits + verification date in `memory.md`
- [ ] Create Telegram bot via @BotFather; store token in environment variable
- [ ] Create Supabase project; apply schema from `architecture.md` §3
- [ ] Create GitHub repo with Actions enabled; confirm a trivial scheduled workflow actually fires on schedule before building anything on top of it

## Phase 1 — Price Fetch Pipeline
- [ ] Write fetch script: `yfinance` pull for `GC=F`, `SI=F`, `INR=X`
- [ ] Implement price calculator (spot × fx × (1 + duty + GST)); verify current GST rate on gold before hardcoding it
- [ ] Write to `prices` table
- [ ] Implement last-known-good cache fallback for when `yfinance` fails (test this path deliberately — don't just hope it's never needed)
- [ ] Wire the fetch script into the GitHub Actions hourly schedule (not Vercel Cron)
- [ ] Let it run for 24 hours unattended; confirm in `prices` table that it actually fired ~24 times, not fewer

## Phase 2 — Historical Context Engine
- [ ] Implement 30-day trailing percentile calculation
- [ ] Hand-compute the expected percentile for 3 known historical price sequences; confirm the code matches by hand before trusting it (this is the one piece of "ML" logic here and the only one worth a real correctness check)
- [ ] Confirm output is a plain-language statement ("lowest 15%"), never a raw prediction

## Phase 3 — Telegram Webhook + Agent
- [ ] Set up webhook handler (Vercel function)
- [ ] Wire Gemini agent: input = user question + Historical Context Engine output; system prompt explicitly forbids predictive/directive language (see `rules.md`)
- [ ] Implement canned-template fallback for when Gemini is unavailable/rate-limited
- [ ] Implement Response Formatter that appends the mandatory disclaimer to every price message — write a test asserting the disclaimer string is present in 100% of price-related outputs, not just most

## Phase 4 — Voice
- [ ] Wire Edge-TTS with `hi-IN-SwaraNeural`
- [ ] Implement text-fallback when TTS raises an exception
- [ ] Have a native/fluent Hindi speaker review the actual message templates before this goes live for real use — not optional, this hasn't been verified yet

## Phase 5 — Alerts + Daily Digest
- [ ] Implement `alerts` table + check logic inside the hourly fetch job
- [ ] Implement daily digest (Vercel Cron, once/day — this cadence is fine on Hobby)
- [ ] Add inline keyboard buttons per `design.md` §5

## Phase 6 — Optional, Explicitly Gated: Predictive Model
**Do not start this phase unless Phases 0–5 are live and stable for at least a few weeks of real use.**
- [ ] If pursued: define a walk-forward backtest methodology *before* training anything
- [ ] Train candidate model; report out-of-sample performance honestly, including the periods where it's wrong
- [ ] If (and only if) the backtest shows genuine, statistically distinguishable-from-chance edge: design how it's surfaced with clear "experimental, unvalidated in production" framing distinct from the rest of the bot's confident voice
- [ ] If the backtest doesn't show real edge: document that finding in `memory.md` and stop — a documented honest negative result is a legitimate outcome, not a failure to hide

## Phase 7 — Wrap-up
- [ ] Confirm zero recurring cost across all services used
- [ ] Confirm GitHub Actions scheduled workflow re-enable reminder exists (60-day inactivity auto-disable)
- [ ] Final review of every message template against `rules.md` §1
