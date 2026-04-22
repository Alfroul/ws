export interface Spinner {
  start(): Spinner;
  stop(): Spinner;
  succeed(text?: string): Spinner;
  fail(text?: string): Spinner;
  text: string;
}

export function createSpinner(text: string): Spinner {
  return {
    text,
    start() {
      console.log(`⠋ ${text}`);
      return this;
    },
    stop() {
      return this;
    },
    succeed(succeedText?: string) {
      console.log(`✔ ${succeedText ?? text}`);
      return this;
    },
    fail(failText?: string) {
      console.log(`✖ ${failText ?? text}`);
      return this;
    },
  };
}
