import { describe, expect, test } from "bun:test";
import { RateLimiter } from "../rateLimit";

describe("RateLimiter", () => {
  test("allows events up to the limit", () => {
    const limiter = new RateLimiter(3, 10_000);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false); // 4th within window is rejected
  });

  test("allows events again once the window has passed", async () => {
    const limiter = new RateLimiter(1, 50);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(limiter.tryConsume()).toBe(true);
  });
});
