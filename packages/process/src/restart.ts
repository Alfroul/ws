export interface RestartPolicy {
  maxRestarts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RestartState {
  attemptCount: number;
  lastRestartAt?: Date;
}

const DEFAULT_POLICY: RestartPolicy = {
  maxRestarts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 4000,
  backoffMultiplier: 2,
};

export interface RestartTracker {
  canRestart(): boolean;
  getNextDelay(): number;
  recordRestart(): void;
  reset(): void;
  getState(): RestartState;
}

export function createRestartTracker(
  policy?: Partial<RestartPolicy>,
): RestartTracker {
  const p: RestartPolicy = { ...DEFAULT_POLICY, ...policy };
  const state: RestartState = { attemptCount: 0 };

  return {
    canRestart() {
      return state.attemptCount < p.maxRestarts;
    },

    getNextDelay() {
      const delay =
        p.initialDelayMs * Math.pow(p.backoffMultiplier, state.attemptCount);
      return Math.min(delay, p.maxDelayMs);
    },

    recordRestart() {
      state.attemptCount++;
      state.lastRestartAt = new Date();
    },

    reset() {
      state.attemptCount = 0;
      state.lastRestartAt = undefined;
    },

    getState() {
      return { ...state };
    },
  };
}
