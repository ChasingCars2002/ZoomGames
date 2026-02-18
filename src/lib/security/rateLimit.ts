interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  room_create: { maxAttempts: 5, windowMs: 60000 },
  chat_message: { maxAttempts: 5, windowMs: 3000 },
  guess_attempt: { maxAttempts: 3, windowMs: 2000 },
  draw_stroke: { maxAttempts: 30, windowMs: 1000 },
  player_action: { maxAttempts: 10, windowMs: 5000 },
};

const timestamps: Record<string, number[]> = {};

export function checkRateLimit(action: string): { allowed: boolean; retryAfter: number } {
  const config = RATE_LIMITS[action];
  if (!config) return { allowed: true, retryAfter: 0 };

  const now = Date.now();
  if (!timestamps[action]) timestamps[action] = [];

  timestamps[action] = timestamps[action].filter((t) => now - t < config.windowMs);

  if (timestamps[action].length >= config.maxAttempts) {
    const oldest = timestamps[action][0];
    const retryAfter = config.windowMs - (now - oldest);
    return { allowed: false, retryAfter };
  }

  timestamps[action].push(now);
  return { allowed: true, retryAfter: 0 };
}

export function resetRateLimit(action: string): void {
  delete timestamps[action];
}
