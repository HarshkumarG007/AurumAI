-- Aurum AI Database Schema
-- Version: 2.0 (2026-09-27)
-- Compliant with Aurum_AI_Specification.md §7 and RULE-017

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    chat_id BIGINT PRIMARY KEY,
    preferred_metal TEXT NOT NULL DEFAULT 'gold_24k' CHECK (preferred_metal IN ('gold_24k', 'gold_22k', 'silver')),
    target_price_inr NUMERIC(12, 2),
    tts_voice TEXT NOT NULL DEFAULT 'hi-IN-SwaraNeural',
    interaction_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Market Data table
CREATE TABLE IF NOT EXISTS market_data (
    id BIGSERIAL PRIMARY KEY,
    metal TEXT NOT NULL CHECK (metal IN ('gold_24k', 'gold_22k', 'silver')),
    price_inr NUMERIC(12, 2) NOT NULL,
    price_usd NUMERIC(12, 4) NOT NULL,
    fx_rate NUMERIC(10, 4) NOT NULL,
    duty_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.1500,
    gst_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.0300,
    ma7 NUMERIC(12, 2),
    ma15 NUMERIC(12, 2),
    ma30 NUMERIC(12, 2),
    trend_signal_value NUMERIC(10, 4),
    -- RULE-017: trend_signal_validated defaults to FALSE in the schema.
    -- No code path may override this default without the backtest result setting it TRUE.
    trend_signal_validated BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT NOT NULL DEFAULT 'yfinance',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_data_metal_fetched_at ON market_data (metal, fetched_at DESC);

-- 3. Alert History table
CREATE TABLE IF NOT EXISTS alert_history (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('target_hit', 'ma_deviation', 'trend_anomaly')),
    metal TEXT NOT NULL CHECK (metal IN ('gold_24k', 'gold_22k', 'silver')),
    price_at_alert NUMERIC(12, 2),
    reference_price NUMERIC(12, 2),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_chat_type ON alert_history (chat_id, alert_type, triggered_at DESC);

-- 4. Chat Log table (Retention: 90 days per spec §7)
CREATE TABLE IF NOT EXISTS chat_log (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('incoming_text', 'incoming_voice', 'outgoing_text', 'outgoing_voice')),
    content TEXT NOT NULL,
    model_used TEXT,
    used_tts BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_log_created_at ON chat_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_log_chat_id ON chat_log (chat_id);
