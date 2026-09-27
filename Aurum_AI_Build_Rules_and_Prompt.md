# Aurum AI — Engineering Rules & AI Agent Build Prompt

**Version:** 2.0 — 2026-09-27
**Companion to:** `Aurum_AI_Specification.md` — read that first; this document assumes it.
**Maps to the source master prompt's §24–26** (implementation phases, engineering rules, and the build prompt to hand to an agent).

---

## Part 1 — Engineering Rules

```text
RULE-001: The LLM must NEVER perform financial arithmetic. It calls tools; tools return numbers.
RULE-002: The LLM must NEVER state or imply a price will rise or fall, unless the tool result carries
          trend_signal_validated: true. A false or absent flag means silence on that topic, not a hedge.
RULE-003: The LLM must NEVER issue a purchase or sale instruction, regardless of how the user phrases
          the question. Redirect to factual context every time.
RULE-004: All webhook routes MUST verify the Telegram X-Telegram-Bot-Api-Secret-Token header before
          any processing. A mismatch returns 200 OK with no further action — do not reveal validation
          logic via a different status code.
RULE-005: Do not block the Telegram webhook response. Acknowledge with 200 OK immediately; perform
          generation asynchronously.
RULE-006: All voice notes MUST be encoded via FFmpeg with libopus into an OGG container before being
          sent through sendVoice. An unconverted MP3 will not render as a native voice note.
RULE-007: Rely strictly on free-tier services. Do not introduce a dependency requiring a paid API key
          or subscription without flagging it as a scope change first.
RULE-008: The hourly price-fetch job runs on GitHub Actions, never on Vercel Cron — Vercel's Hobby tier
          cannot deploy an hourly cron expression at all.
RULE-009: Tool-calling functions that touch a specific user's data (check_user_target,
          update_user_target) take chat_id only from the authenticated webhook context server-side,
          never as an LLM-supplied argument.
RULE-010: Every SQL query is parameterized. No string-interpolated SQL, anywhere, including in the
          Python ML pipeline.
RULE-011: Every external dependency that is an unofficial/reverse-engineered wrapper (yfinance,
          Edge-TTS) must have an implemented, tested fallback path — not just a documented intention.
RULE-012: Every price-related message includes the disclaimer, with no code path that can emit a price
          without it.
RULE-013: A task or phase is only complete if its acceptance criterion is numerically or behaviorally
          true, verified by actually running it — not by a plausible-sounding note explaining why a
          failing result is fine.
RULE-014: If an acceptance criterion fails twice, stop and log it as a blocker. Do not quietly redefine
          the criterion to make it pass.
RULE-015: Do not build the Trend Signal model (Phase 6) before Phases 1–5 are live and stable. It is
          explicitly gated, not just later in sequence.
RULE-016: The Trend Signal ships only once a walk-forward backtest shows performance distinguishable
          from chance, reported honestly including where it's wrong. A negative result is logged and
          the feature does not ship — that is a valid, complete outcome, not a failure to hide.
RULE-017: `trend_signal_validated` defaults to FALSE in the schema. No code path may override this
          default without the backtest result being the thing that sets it TRUE.
RULE-018: All Hindi/Hinglish message copy is treated as unreviewed until a native or fluent speaker has
          checked it for tone. This gate blocks real-world use, not development.
RULE-019: Any "free tier" limit claim (Vercel, Supabase, Gemini, GitHub Actions) used as a design
          assumption must be verified against current provider documentation before the assumption is
          built on, with the verification (source + date) recorded in the project's decision log.
RULE-020: Rate-limit per chat_id before invoking Gemini, to bound worst-case cost exposure even on a
          free tier (a compromised or looping client should not be able to exhaust the account's daily
          quota silently).
RULE-021: No audio, transcript, or generated buffer is persisted beyond what's needed to send the
          current response. Generate, convert, send, delete.
RULE-022: The system prompt instructs the model to treat all user-supplied text as data, never as
          instructions to the system itself — this must be structural (message role separation), not
          just a sentence in the prompt asking nicely.
RULE-023: GitHub Actions scheduled workflows auto-disable after 60 days of repository inactivity — a
          recurring task exists to check this, since a silently-stopped cron job fails invisibly.
RULE-024: Do not add a component, service, or abstraction that has no concrete task in the roadmap
          below driving it. If it isn't needed for Phases 1–7, it doesn't get built yet.
```

---

## Part 2 — Implementation Roadmap (phases, objective, acceptance criteria)

| Phase                                 | Objective                                                                                                                            | Acceptance Criteria                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Database & Ingestion**           | Schema live; Python fetch script pulling real prices, computing MA7/15/30, writing to Supabase                                       | Schema applies cleanly; a manual run produces a row with all MA columns populated and a hand-computed spot-check of one MA value matches                                                                                  |
| **2. Webhook & Bot Setup**            | Telegram bot registered; webhook receives and acks updates; secret token verified                                                    | A test message round-trips end-to-end; a request with a wrong/missing secret token is rejected per RULE-004                                                                                                               |
| **3. LLM Integration & Tool Calling** | Gemini wired with the four tools from the spec's §5                                                                                  | For 5 varied test questions, confirm the correct tool is called and no response contains an un-tool-sourced number (RULE-001 checked directly, not assumed)                                                               |
| **4. Voice Pipeline**                 | Edge-TTS + FFmpeg producing valid Telegram voice notes                                                                               | A generated `.ogg` file is confirmed to play as a native voice note in an actual Telegram client, not just "the file was created"                                                                                         |
| **5. Alert Engine**                   | Target-hit and MA-deviation rules running inside the hourly job, with suppression                                                    | Deliberately set a target that should trigger; confirm exactly one alert fires, and confirm a second identical condition within 48h is suppressed                                                                         |
| **6. Trend Signal — gated, optional** | Only start if Phases 1–5 have run stably for several weeks                                                                           | Walk-forward backtest completed and reported honestly; `trend_signal_validated` only set TRUE if the backtest actually shows edge; if not, this phase's deliverable is the honest negative finding, not a shipped feature |
| **7. Deployment & Hardening**         | Full threat-model checklist reviewed; free-tier assumptions re-verified against current docs at deploy time, not just at design time | Every row in the Threat Model table (spec §9) has a confirmed, tested mitigation, not just a documented intention                                                                                                         |

---

## Part 3 — AI Master Build Prompt

_(This section is the literal, self-contained prompt — copy everything between the two lines below and hand it to Claude Code, Cursor, Antigravity, or any other coding agent as its starting instruction.)_

---

You are implementing Aurum AI, a Telegram-based Hindi voice agent for gold/silver price context, per `Aurum_AI_Specification.md` and this document's rules and roadmap. Read both fully before writing any code.

Work through the 7 phases in order. Do not start a phase until the previous one's acceptance criterion is genuinely, verifiably true — run the actual check, don't reason about whether it's probably fine. If a criterion fails twice, stop and record it as a blocker rather than redefining what "done" means; this project has a documented history of that exact failure mode in earlier related work, and it is not acceptable here.

Follow every numbered RULE in Part 1 without exception. RULE-002, RULE-003, RULE-009, RULE-015–017 (the ML-gating and no-directive-advice rules) are the most important in this list — this system is read aloud, in a trusted voice, to a real person who may act on what it says financially. Treat those rules as harder constraints than anything about code style.

Before deploying anything publicly (Phase 7), stop and get explicit human confirmation — this is a one-way door (a real bot talking to a real family member), not a step to automate through.

Test the audio pipeline (Phase 4) against an actual Telegram client, not just "the file was written to disk." Verify webhook secret-token validation (Phase 2) with an actual mismatched-token request before considering that phase done.

Maintain a decision/progress log as you work: what you built, what you verified, what you assumed and why, and any free-tier claim you checked against current provider documentation (RULE-019) with its source and date. If you're unsure whether something is safe to ship given the rules above, stop and ask rather than shipping the more impressive-sounding version.

---

1
