import { describe, it, expect } from "vitest";
import { createRestartTracker } from "../src/restart.js";

describe("createRestartTracker", () => {
  it("canRestart() returns true when under maxRestarts limit", () => {
    const tracker = createRestartTracker();
    expect(tracker.canRestart()).toBe(true);
  });

  it("canRestart() returns false after reaching maxRestarts", () => {
    const tracker = createRestartTracker();
    for (let i = 0; i < 3; i++) {
      tracker.recordRestart();
    }
    expect(tracker.canRestart()).toBe(false);
  });

  it("getNextDelay() returns increasing delays (exponential backoff)", () => {
    const tracker = createRestartTracker();
    const delays: number[] = [];
    for (let i = 0; i < 3; i++) {
      delays.push(tracker.getNextDelay());
      tracker.recordRestart();
    }
    // Default: initialDelayMs=1000, backoffMultiplier=2
    // 1000 -> 2000 -> 4000
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);
    expect(delays[2]).toBe(4000);
  });

  it("getNextDelay() never exceeds maxDelayMs", () => {
    const tracker = createRestartTracker();
    // With default policy, maxDelayMs is 4000
    // Simulate many restarts
    for (let i = 0; i < 10; i++) {
      tracker.recordRestart();
    }
    expect(tracker.getNextDelay()).toBeLessThanOrEqual(4000);
  });

  it("reset() clears attempt count", () => {
    const tracker = createRestartTracker();
    tracker.recordRestart();
    tracker.recordRestart();
    tracker.reset();
    expect(tracker.canRestart()).toBe(true);
    expect(tracker.getState().attemptCount).toBe(0);
  });

  it("accepts custom policy", () => {
    const tracker = createRestartTracker({ maxRestarts: 5, initialDelayMs: 500, maxDelayMs: 8000 });
    for (let i = 0; i < 5; i++) {
      expect(tracker.canRestart()).toBe(true);
      tracker.recordRestart();
    }
    expect(tracker.canRestart()).toBe(false);
    // First delay should be 500
    const fresh = createRestartTracker({ initialDelayMs: 500 });
    expect(fresh.getNextDelay()).toBe(500);
  });
});
