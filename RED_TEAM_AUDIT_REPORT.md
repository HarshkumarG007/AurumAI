# Aurum AI — Red Team Privacy & Security Audit Report

**Date of Audit:** 2026-09-27  
**Auditor Classification:** Lead Red Team Security Architect & Vulnerability Analyst  
**Scope:** Full-Stack Architecture, Telegram Webhook, LLM Tool Pipeline, Supabase Database, Next.js Web Surface, Memory Lifecycle & Git History.  
**Audit Standard:** OWASP Top 10 API Security, CWE/SANS Top 25 Most Dangerous Software Weaknesses, NIST SP 800-53.

---

## 1. Executive Summary

A comprehensive Red Team adversarial privacy and security audit was conducted against the **Aurum AI** production architecture. Seven primary vulnerabilities and abuse vectors were uncovered, ranging from **Unauthenticated IDOR Account Tampering** to **Timing-Attack Side-Channels** and **In-Memory Heap Exhaustion (DoS)**.

All seven vulnerabilities have been **fully patched, remediated, verified via automated test suites**, and deployed to production on `main` (`commit e365b97`).

---

## 2. Threat Vector Matrix & Remediation Log

| Vulnerability ID | Vulnerability Classification | Severity | Impact Vector | Status | Remediated In |
|---|---|---|---|---|---|
| **VULN-01** | **Unauthenticated IDOR / Account Hijacking** | **HIGH** | Web clients could supply arbitrary `chat_id`s to `/api/alerts/create` and overwrite real family members' targets. | **REMEDIATED** | [`app/api/alerts/create/route.ts`](./app/api/alerts/create/route.ts) |
| **VULN-02** | **Timing-Attack on Secret Tokens (CWE-208)** | **MEDIUM** | Standard string `!==` terminates at first byte mismatch, enabling remote timing reconstruction of secrets. | **REMEDIATED** | [`app/api/telegram/webhook/route.ts`](./app/api/telegram/webhook/route.ts) & [`app/api/cron/process-alerts/route.ts`](./app/api/cron/process-alerts/route.ts) |
| **VULN-03** | **Missing HTTP Security Headers (Clickjacking / MIME Sniffing)** | **MEDIUM** | Lack of `X-Frame-Options` and `nosniff` left the site open to clickjacking and MIME confusion. | **REMEDIATED** | [`next.config.mjs`](./next.config.mjs) |
| **VULN-04** | **In-Memory Heap Exhaustion DoS (CWE-400)** | **MEDIUM** | Generating 1,000,000 arbitrary chat IDs caused `requestTimestamps` Map to grow without bounds. | **REMEDIATED** | [`agent/utils/rate_limit.ts`](./agent/utils/rate_limit.ts) |
| **VULN-05** | **Prompt Injection & Token Exhaustion (Denial-of-Wallet)** | **MEDIUM** | Unbounded prompt lengths could consume token quotas or override system persona boundaries. | **REMEDIATED** | [`agent/gemini_agent.ts`](./agent/gemini_agent.ts) |
| **VULN-06** | **Unauthenticated Alert Endpoint Flooding** | **LOW-MED** | Lack of rate limiting on alert creation endpoint allowed bots to spam Supabase database connections. | **REMEDIATED** | [`app/api/alerts/create/route.ts`](./app/api/alerts/create/route.ts) |
| **VULN-07** | **PII & Hardcoded Telegram Identifiers in Scripts** | **HIGH (Privacy)** | Hardcoded chat ID `REDACTED_CHAT_ID` existed in test scripts and documentation logs. | **REMEDIATED** | [`scripts/test_agent_full.ts`](./scripts/test_agent_full.ts) & [`memory.md`](./memory.md) |

---

## 3. Deep-Dive Vulnerability Analysis & Technical Fixes

### 3.1 VULN-01: Insecure Direct Object Reference (IDOR) on `/api/alerts/create`
* **Vulnerability Mechanics:** The alert registration route accepted an arbitrary `chat_id` and performed an `upsert` directly into the Supabase `users` table without verifying whether the request came from that Telegram user.
* **Remediation:**
  1. Whitelisted sandbox demonstration IDs: `[87654321, 999999999, 12345678]`.
  2. Any public web visitor submitting an arbitrary unauthenticated `chat_id` is executed in **isolated sandbox simulation mode** (`mode: SANDBOX_SIMULATION`), returning live trigger calculations without mutating database state.
  3. Production database writes for real chat IDs are restricted strictly to authenticated webhook updates or administrative calls carrying a verified `CRON_SECRET`.

### 3.2 VULN-02: Cryptographic Timing Attack Defense (CWE-208)
* **Vulnerability Mechanics:** `incomingSecret !== configuredSecret` evaluated strings using non-constant-time byte comparison.
* **Remediation:** Implemented `safeCompare` using Node.js `crypto.timingSafeEqual`:
  ```typescript
  function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
  ```
  Verified via automated unit tests that single-byte differences execute in constant time.

### 3.3 VULN-03: HTTP Security Headers Hardening
* **Vulnerability Mechanics:** `next.config.mjs` lacked basic HTTP security headers.
* **Remediation:** Injected strict security headers on all routes (`/(.*)`):
  * `X-Frame-Options: DENY` (prevents clickjacking via iframe embedding)
  * `X-Content-Type-Options: nosniff` (prevents MIME confusion attacks)
  * `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (enforces HTTPS)
  * `Referrer-Policy: strict-origin-when-cross-origin` (prevents URL leakage)
  * `Permissions-Policy: camera=(), microphone=(), geolocation=()` (disables unused device APIs)
  * `X-XSS-Protection: 1; mode=block`

### 3.4 VULN-04: In-Memory Heap Exhaustion (DoS Defense)
* **Vulnerability Mechanics:** `requestTimestamps` in `rate_limit.ts` stored timestamps per identifier indefinitely, allowing memory to balloon if flooded with random identifiers.
* **Remediation:**
  1. Bound storage capacity with `MAX_TRACKED_IDENTIFIERS = 5000`.
  2. Active key reclamation: If an identifier has no timestamps in the active window, `requestTimestamps.delete(key)` is invoked immediately.
  3. Automatic LRU eviction when capacity exceeds 5,000 keys.
  4. Tested with a simulated 6,000-key flood attack with zero memory leaks.

### 3.5 VULN-05: Prompt Injection & Denial of Wallet
* **Vulnerability Mechanics:** Raw user input was passed directly into `ai.models.generateContent({ contents })` without length bounds.
* **Remediation:**
  1. **Strict Truncation:** User inputs are capped at 500 characters (`userMessage.trim().slice(0, 500)`).
  2. **Data-Instruction Boundary (RULE-022):** Encapsulated within `<user_query>` XML blocks with explicit system framing instructing the model that user content can never alter safety rules or disclaimers.

---

## 4. Verification Evidence

The security suite was validated with automated test execution:

```
[Pytest Ingestion, Formulas & Voice]     tests/test_phase1_ingestion.py ...       18 / 18 PASSED
[TypeScript Webhook & Tool Calling]      tests/test_phase2_webhook.mjs ...        11 / 11 PASSED
[Threat Model Mitigation Verification]   tests/test_phase7_threat_model.mjs ...    5 / 5  PASSED
[Red Team Timing, DoS & IDOR Suite]      tests/test_red_team_audit.mjs ...       12 / 12 PASSED
------------------------------------------------------------------------------------------------
TOTAL AUTOMATED SECURITY TEST SUITE:                                             46 / 46 PASSED (100%)
```

Next.js production build verified:
```
✓ Compiled successfully in 1193ms
✓ Generating static pages (6/6)
✓ Finalizing page optimization
```
All patches committed in Git (`e365b97`) and pushed to GitHub `main`.
