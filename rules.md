# rules.md — Development Rules & AI Guidelines

**Version:** 1.0 — 2026-09-27
**Purpose:** A strict rulebook for whoever (human or AI coding agent) implements this project. Read before writing code.

---

## 1. Non-Negotiable Product Safety Rules

- **Every message containing a price must include the disclaimer.** Short form: *"Yeh anumaanit keemat hai, sthaniya dukaandaar se keemat alag ho sakti hai. Yeh salaah nahi hai."* (This is an estimated price, it may differ from your local dealer's price. This is not advice.) Have a native/fluent Hindi speaker review this exact phrasing before shipping — it has not been independently verified for tone by a native speaker in this process.
- **Never generate or allow the agent to generate a directive statement** ("buy now", "sell now", "aaj khareedna theek hai" without qualification). The Historical Context Engine may state facts ("today is in the lowest 15% of the last 30 days"); it may never convert that into an instruction.
- **The agent's prompt must not ask Gemini to predict future price direction.** It only receives past/current data and is instructed to describe, not forecast.
- **No feature ships that claims predictive accuracy without a walk-forward backtest and an explicit statement of what "validated" means for this project.** If a predictive model is added later (see `task.md` Phase 6, explicitly optional), it ships labeled experimental and is never given the same confident voice as the rest of the bot until it has one.

## 2. Process Rules (carried forward from prior project audits — apply strictly)

- **A task is only complete if its stated acceptance check is actually, numerically true.** Do not mark a task done with a narrative excuse for why a failing number is "fine" or "expected." If a check fails twice, stop and record it as a blocker in `memory.md` rather than quietly redefining what "done" means.
- **Never assume a "free tier" claim is still accurate — verify it against current provider documentation before building around it**, and record the verification (source + date) in `memory.md`. This project already found two stale assumptions in its own original brainstorm (Vercel Cron's actual Hobby-tier cadence limit, and a specific LLM version pin) before a single line of code was written — treat that as the expected rate of drift, not a one-off.
- **No self-graded validation.** If a feature is tested only against data or scenarios the same person/agent invented to make it pass, that is not validation — it is a demo. Where feasible, sanity-check the Historical Context Engine's percentile output against a manually-checked example, not just its own unit tests.
- **Every external dependency that is an unofficial/reverse-engineered wrapper (`yfinance`, Edge-TTS) must have a documented fallback path, implemented, not just planned.** A silent failure in either is worse than a slightly ugly fallback message.

## 3. Coding Standards

| Area | Rule |
|---|---|
| Language | Python for the fetch/ML/TTS pipeline; Next.js (Node/TypeScript) for the webhook, matching the original stack choice |
| Config | All model names, duty/GST percentages, and thresholds in a config file or environment variables — never hardcoded inline, since these are exactly the values likely to need updating |
| Error handling | Every external call (`yfinance`, Gemini, Edge-TTS, Telegram send) wrapped in try/except with a defined fallback per `architecture.md` §6 — no bare `except: pass` |
| Logging | Every price fetch and every agent response logged to `requests_log`/`prices` with timestamp and source, so any output can be traced back to what produced it |
| Secrets | Telegram bot token, Gemini API key, Supabase credentials in environment variables only, never committed |
| Testing | Historical Context Engine (the only genuinely testable logic here) gets real unit tests against hand-computed examples, not just "it ran without crashing" |

## 4. Preferred Libraries

- `python-telegram-bot` or direct Telegram Bot API calls (avoid an unnecessary extra framework for a single-user bot)
- `yfinance` for price data (with the fallback in `architecture.md`)
- `edge-tts` for voice synthesis (with the fallback in `architecture.md`)
- `supabase-py` or direct `psycopg2`/`asyncpg` for the Postgres connection
- Google's official `google-genai` SDK for Gemini calls

## 5. What To Avoid

- Do not add multi-user auth infrastructure — out of scope per `PRD.md`.
- Do not attempt exact MCX price matching — approximate, disclosed, and move on.
- Do not let the Gemini agent free-associate financial commentary beyond what the Historical Context Engine's structured data supports — it composes tone and phrasing, not new facts.
- Do not schedule the price-fetch job on Vercel Cron.
