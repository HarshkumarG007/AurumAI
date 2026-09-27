/**
 * Aurum AI - Per Chat ID Rate Limiter
 * Complies with RULE-020: Rate-limit per chat_id before invoking Gemini.
 */

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 15,
  maxRequestsPerHour: 60,
};

// In-memory timestamps store: chatId -> timestamps[]
const requestTimestamps = new Map<number | string, number[]>();

export function checkRateLimit(
  chatId: number | string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; retryAfterSeconds?: number; reason?: string } {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  let timestamps = requestTimestamps.get(chatId) || [];
  // Purge entries older than 1 hour
  timestamps = timestamps.filter((t) => t > oneHourAgo);

  // Check 1-minute window
  const minuteCount = timestamps.filter((t) => t > oneMinuteAgo).length;
  if (minuteCount >= config.maxRequestsPerMinute) {
    const oldestInMinute = timestamps.filter((t) => t > oneMinuteAgo)[0];
    const retryAfter = Math.ceil((oldestInMinute + 60 * 1000 - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfter),
      reason: "minute_limit_exceeded",
    };
  }

  // Check 1-hour window
  if (timestamps.length >= config.maxRequestsPerHour) {
    const oldestInHour = timestamps[0];
    const retryAfter = Math.ceil((oldestInHour + 60 * 60 * 1000 - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, retryAfter),
      reason: "hour_limit_exceeded",
    };
  }

  // Record this request
  timestamps.push(now);
  requestTimestamps.set(chatId, timestamps);

  return { allowed: true };
}

export function resetRateLimits(): void {
  requestTimestamps.clear();
}
