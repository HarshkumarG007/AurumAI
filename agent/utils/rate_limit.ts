/**
 * Aurum AI - Per Chat ID & IP Rate Limiter
 * Complies with RULE-020: Rate-limit per chat_id before invoking Gemini.
 * Hardened against memory leaks and DoS key-flooding.
 */

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 15,
  maxRequestsPerHour: 60,
};

const MAX_TRACKED_IDENTIFIERS = 5000;

// In-memory timestamps store: identifier -> timestamps[]
const requestTimestamps = new Map<string, number[]>();

/**
 * Prunes the map if it exceeds maximum capacity to prevent Heap Out-of-Memory DoS
 */
function pruneStorageIfNeeded() {
  if (requestTimestamps.size > MAX_TRACKED_IDENTIFIERS) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, timestamps] of requestTimestamps.entries()) {
      const active = timestamps.filter((t) => t > oneHourAgo);
      if (active.length === 0) {
        requestTimestamps.delete(key);
      } else {
        requestTimestamps.set(key, active);
      }
    }
    // If still over capacity, evict the oldest 20%
    if (requestTimestamps.size > MAX_TRACKED_IDENTIFIERS) {
      let count = 0;
      const targetEvictions = Math.floor(MAX_TRACKED_IDENTIFIERS * 0.2);
      for (const key of requestTimestamps.keys()) {
        requestTimestamps.delete(key);
        count++;
        if (count >= targetEvictions) break;
      }
    }
  }
}

export function checkRateLimit(
  chatId: number | string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; retryAfterSeconds?: number; reason?: string } {
  const now = Date.now();
  const key = String(chatId);
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  pruneStorageIfNeeded();

  let timestamps = requestTimestamps.get(key) || [];
  // Purge entries older than 1 hour
  timestamps = timestamps.filter((t) => t > oneHourAgo);

  // If no active timestamps, remove key to avoid memory creep
  if (timestamps.length === 0) {
    requestTimestamps.delete(key);
  }

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
  requestTimestamps.set(key, timestamps);

  return { allowed: true };
}

/**
 * Generic IP / API endpoint rate limiter
 */
export function checkEndpointRateLimit(
  identifier: string,
  maxPerWindow: number = 10,
  windowSeconds: number = 60
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const key = `ip_${identifier}`;
  const windowAgo = now - windowSeconds * 1000;

  pruneStorageIfNeeded();

  let timestamps = requestTimestamps.get(key) || [];
  timestamps = timestamps.filter((t) => t > windowAgo);

  if (timestamps.length >= maxPerWindow) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + windowSeconds * 1000 - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  timestamps.push(now);
  requestTimestamps.set(key, timestamps);
  return { allowed: true };
}

export function resetRateLimits(): void {
  requestTimestamps.clear();
}
