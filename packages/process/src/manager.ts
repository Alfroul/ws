import { spawnCommand } from "./spawn.js";
import {
  createRestartTracker,
  type RestartTracker,
} from "./restart.js";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { ChildProcess } from "node:child_process";

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export interface ManagedProcess {
  pid: number;
  name: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  process: ChildProcess;
  logPath?: string;
}

export class ProcessManager {
  private processes = new Map<number, ManagedProcess>();
  private crashCallbacks: Array<
    (pid: number, code: number | null, serviceName: string) => void
  > = [];
  private restartCallbacks: Array<
    (oldPid: number, newPid: number, serviceName: string) => void
  > = [];
  private logDir: string;
  private restartTrackers = new Map<string, RestartTracker>();
  private pendingRestarts = new Map<string, NodeJS.Timeout>();

  constructor(options?: { logDir?: string }) {
    this.logDir = options?.logDir ?? ".ws/logs";
  }

  async start(
    command: string,
    options?: {
      name?: string;
      cwd?: string;
      env?: Record<string, string>;
    },
  ): Promise<{ pid: number }> {
    const name = options?.name ?? "unknown";
    const logPath = resolve(this.logDir, `${name}.log`);

    await ensureDir(this.logDir);

    const { pid, process: child } = spawnCommand(command, {
      cwd: options?.cwd,
      env: options?.env,
      logPath,
    });

    const managed: ManagedProcess = {
      pid,
      name,
      command,
      cwd: options?.cwd,
      env: options?.env,
      process: child,
      logPath,
    };

    this.processes.set(pid, managed);

    child.on("exit", (code) => {
      this.processes.delete(pid);

      if (code !== 0 && code !== null) {
        this.handleCrash(pid, code, name, command, options);
      }
    });

    return { pid };
  }

  private handleCrash(
    pid: number,
    code: number,
    name: string,
    command: string,
    options?: { name?: string; cwd?: string; env?: Record<string, string> },
  ): void {
    if (!this.restartTrackers.has(name)) {
      this.restartTrackers.set(name, createRestartTracker());
    }
    const tracker = this.restartTrackers.get(name)!;

    if (tracker.canRestart()) {
      const delay = tracker.getNextDelay();
      tracker.recordRestart();

      this.pendingRestarts.delete(name);
      const timer = setTimeout(() => {
        this.pendingRestarts.delete(name);
        this.start(command, {
          name,
          cwd: options?.cwd,
          env: options?.env,
        }).then(({ pid: newPid }) => {
          for (const cb of this.restartCallbacks) {
            cb(pid, newPid, name);
          }
        }).catch(() => {
          for (const cb of this.crashCallbacks) {
            cb(pid, code, name);
          }
        });
      }, delay);
      this.pendingRestarts.set(name, timer);
    } else {
      this.restartTrackers.delete(name);
      for (const cb of this.crashCallbacks) {
        cb(pid, code, name);
      }
    }
  }

  async stop(pid: number): Promise<void> {
    const managed = this.processes.get(pid);
    if (!managed) return;

    this.cancelPendingRestart(managed.name);

    managed.process.removeAllListeners("exit");
    this.processes.delete(pid);
    this.restartTrackers.delete(managed.name);

    const child = managed.process;

    if (child.killed) return;

    try {
      if (process.platform === "win32") {
        child.kill();
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // Process may have already exited
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          if (process.platform === "win32") {
            child.kill();
          } else {
            child.kill("SIGKILL");
          }
        } catch {
          // Already dead
        }
        resolve();
      }, 10000);

      child.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });

      if (child.exitCode !== null) {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  private cancelPendingRestart(name: string): void {
    const timer = this.pendingRestarts.get(name);
    if (timer) {
      clearTimeout(timer);
      this.pendingRestarts.delete(name);
    }
  }

  async restart(pid: number): Promise<{ pid: number }> {
    const managed = this.processes.get(pid);
    if (!managed) {
      throw new Error(`Process with PID ${pid} not found`);
    }

    const { command, name, cwd, env } = managed;
    this.cancelPendingRestart(name);
    await this.stop(pid);
    return this.start(command, { name, cwd, env });
  }

  onCrash(
    callback: (pid: number, code: number | null, serviceName: string) => void,
  ): void {
    this.crashCallbacks.push(callback);
  }

  onRestart(
    callback: (oldPid: number, newPid: number, serviceName: string) => void,
  ): void {
    this.restartCallbacks.push(callback);
  }

  async stopAll(): Promise<void> {
    for (const timer of this.pendingRestarts.values()) {
      clearTimeout(timer);
    }
    this.pendingRestarts.clear();
    this.restartTrackers.clear();

    const pids = [...this.processes.keys()];
    await Promise.all(pids.map((pid) => this.stop(pid)));
  }

  getProcesses(): Map<number, ManagedProcess> {
    return new Map(this.processes);
  }

  getProcess(pid: number): ManagedProcess | undefined {
    return this.processes.get(pid);
  }

  getLogPath(serviceName: string): string {
    return resolve(this.logDir, `${serviceName}.log`);
  }
}
