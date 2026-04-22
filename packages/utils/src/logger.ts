export function createLogger(name: string) {
  return {
    info: (...args: unknown[]) => console.log(`[${name}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${name}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${name}]`, ...args),
    debug: (...args: unknown[]) => console.log(`[${name}:debug]`, ...args),
  };
}

export type Logger = ReturnType<typeof createLogger>;
