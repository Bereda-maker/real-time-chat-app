// Simple per-connection sliding-window limiter to blunt spam/flooding.
// In-memory is fine per-connection since it's scoped to one socket's
// lifetime on one instance; it doesn't need to be shared across instances
// the way message delivery does.
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxEvents: number,
    private readonly windowMs: number
  ) {}

  /** Returns true if the event is allowed, false if the caller is over the limit. */
  tryConsume(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    if (this.timestamps.length >= this.maxEvents) return false;
    this.timestamps.push(now);
    return true;
  }
}
