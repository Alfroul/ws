/**
 * Graceful shutdown signal handler.
 * Listens for SIGINT/SIGTERM and runs registered callbacks sequentially.
 * Prevents double-shutdown and forces exit after timeout.
 */
export class SignalHandler {
  private callbacks: Array<() => Promise<void> | void> = [];
  private shuttingDown = false;
  private timeoutMs: number;
  private installed = false;

  constructor(timeoutMs = 10000) {
    this.timeoutMs = timeoutMs;
  }

  register(callback: () => Promise<void> | void): void {
    this.callbacks.push(callback);
  }

  install(): void {
    if (this.installed) return;
    this.installed = true;

    const handler = () => {
      this.handleSignal();
    };

    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);

    // Store references for cleanup
    this._sigintHandler = handler;
    this._sigtermHandler = handler;
  }

  uninstall(): void {
    if (!this.installed) return;
    this.installed = false;

    if (this._sigintHandler) {
      process.off("SIGINT", this._sigintHandler);
    }
    if (this._sigtermHandler) {
      process.off("SIGTERM", this._sigtermHandler);
    }
  }

  private async handleSignal(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    console.log("\nShutting down gracefully...");

    const timeout = setTimeout(() => {
      console.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, this.timeoutMs);

    try {
      for (const cb of this.callbacks) {
        await cb();
      }
    } catch (err) {
      console.error("Error during shutdown:", err);
    }

    clearTimeout(timeout);
    process.exit(0);
  }

  // Private refs for cleanup
  private _sigintHandler?: () => void;
  private _sigtermHandler?: () => void;
}
