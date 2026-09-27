# PRD.md — Product Requirements Document

**Project (working name):** Sona-Chandi Saathi ("Gold-Silver Companion") — a Hindi-voice Telegram bot for daily gold/silver price context
**Version:** 1.0 — 2026-09-27
**Status:** Step 1 of the Vibe Coding Workflow — pre-development

---

## 1. Product Overview

A Telegram bot that answers questions about gold and silver prices in spoken Hindi, for one specific person (a family member, referred to here as "the user"), without requiring her to open an app, read English, or interpret raw numbers herself. It runs entirely on free-tier infrastructure.

## 2. Core Problem

The target user wants to track gold/silver prices and understand whether now is a notable time to pay attention, but:
- Price-tracking apps are usually in English, cluttered, and assume financial literacy she may not have by default.
- She would rather ask a question out loud and hear an answer than read a dashboard.
- A build cost of $0/month is a hard requirement, not a preference.

## 3. Target Audience

**Single named user, not a general product.** This is a deliberate scope decision: no multi-tenant auth system, no user management, no scaling concerns. The bot's Telegram chat ID (or a short allow-list of family chat IDs) is hardcoded/configured, and requests from anyone else are ignored. If this ever needs to serve more than a handful of people, that is a distinct, later scope decision — not assumed here.

## 4. What This Product Is Not (read before building)

- **Not a trading or investment advisory tool.** It provides descriptive, historical context (see §6), never a buy/sell instruction.
- **Not a source of exact, transactable MCX/local jeweler prices.** All INR figures are an approximation from global spot price × forex rate × estimated duty/tax — see `architecture.md` §5 for the exact formula and its known gap versus real local quotes.
- **Not dependent on any single free-tier assumption holding forever.** Every "free" component in `architecture.md` has a documented failure mode and a fallback.

## 5. MVP Features

| # | Feature | Description |
|---|---|---|
| 1 | On-demand price check | User asks (text or voice) "aaj sone ka bhaav kya hai" → bot replies with current approximate gold/silver INR price, spoken in Hindi |
| 2 | Historical context | Every price answer includes where today's price sits relative to the trailing 30-day range (percentile framing, not a prediction — see §6) |
| 3 | Scheduled daily update | Once per day, the bot proactively sends a short voice update, without being asked |
| 4 | Inline quick actions | Telegram inline buttons: `📉 Check Silver`, `📈 Check Gold`, `🔔 Set Alert` |
| 5 | Price alert | User sets a target price; bot checks on each scheduled fetch and notifies if crossed |
| 6 | Mandatory disclaimer | Every price-related message includes a short, plain-language reminder that this is informational context, not financial advice, and may differ from local dealer prices |

## 6. Explicit Non-Goal: Directional Price Prediction

The original brainstorm proposed training a model to predict whether price will go "up or down this week." That is not in this MVP, and the reason is specific, not just cautious: short-horizon price direction on a liquid, globally-traded commodity is extremely difficult to predict with real statistical skill from historical price data alone, and nothing in the original plan included the walk-forward backtesting needed to know whether a trained model actually has edge versus looking good on training data and failing live. Presenting an unvalidated directional signal as confident advice, spoken warmly in Hindi to a trusting family member, is a real-harm risk if she acts on it financially.

**What ships instead:** a purely descriptive **Historical Context Engine** — "today's price is in the bottom 15% of the last 30 days" is a checkable, factual statement, not a prediction. If a genuinely validated predictive model is wanted later, it is a distinct, explicitly-labeled "Phase 2 — experimental, not yet validated" addition (see `task.md`), never silently folded into the same confident voice as the rest of the bot's output.

## 7. Success Criteria

- User can ask a price question by voice or text and receive a correct, disclaimer-included Hindi voice reply within ~10 seconds.
- The daily scheduled update fires reliably (see `architecture.md` for the cron mechanism that actually achieves this on free tiers).
- Zero recurring infrastructure cost.
- No message ever states a price is "the right time to buy" without the historical-context hedge and the disclaimer both present.

## 8. Out of Scope (for now)

- Multi-user support beyond a small family allow-list.
- Exact MCX/dealer-matching price precision.
- A validated predictive trading model.
- Any UI beyond Telegram's native chat interface.
