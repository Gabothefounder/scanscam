type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_IP = Number(process.env.SCAN_RATE_LIMIT_PER_IP ?? 100); // scans per IP per hour

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_IP) {
    return false;
  }

  entry.count += 1;
  return true;
}
