import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { topologicalSort, reverseGroups } from "./scheduler.js";
import { EventBus } from "./events.js";
import type { ServiceInstance, ServiceStatus } from "./lifecycle.js";
import { transition } from "./lifecycle.js";
import type {
  WorkspaceConfig,
  ServiceConfig,
  ProcessServiceConfig,
  DockerServiceConfig,
} from "../../config/src/index.js";
import { loadEnvFile } from "../../config/src/index.js";
import type { ProcessManager } from "../../process/src/index.js";
import type { DockerManager } from "../../docker/src/index.js";
import type { WsPlugin } from "../../plugin-api/src/types.js";
import { HookExecutor } from "../../plugin-api/src/hooks.js";
import {
  saveState,
  clearState,
  updateServiceState,
  type WorkspaceState,
  type ServiceState,
} from "./state.js";

export interface GitManagerLike {
  clone(onProgress?: (percent: number) => void): Promise<void>;
  pull(): Promise<void>;
  status(): Promise<unknown>;
  checkout(targetBranch: string): Promise<void>;
}

export interface EngineOptions {
  processManager: ProcessManager;
  dockerManager?: DockerManager;
  workspaceDir: string;
  createGitManager?: (
    repo: string,
    branch: string,
    workdir: string,
  ) => GitManagerLike;
}

export class WorkspaceEngine {
  private instances = new Map<string, ServiceInstance>();
  private eventBus = new EventBus();
  private processManager: ProcessManager;
  private dockerManager?: DockerManager;
  private workspaceDir: string;
  private createGitManager?: EngineOptions["createGitManager"];
  private config?: WorkspaceConfig;
  private plugins: WsPlugin[] = [];

  constructor(options: EngineOptions) {
    this.processManager = options.processManager;
    this.dockerManager = options.dockerManager;
    this.workspaceDir = options.workspaceDir;
    this.createGitManager = options.createGitManager;

    this.processManager.onMaxRestartsReached((_pid, _code, serviceName) => {
      console.error(`[ws] Service "${serviceName}" failed after max restart attempts, giving up`);
    });
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getPlugins(): WsPlugin[] {
    return [...this.plugins];
  }

  setPlugins(plugins: WsPlugin[]): void {
    this.plugins = plugins;
  }

  async setup(config: WorkspaceConfig): Promise<void> {
    this.config = config;

    await HookExecutor.onConfigLoaded(this.plugins, config);
    this.eventBus.emit("setup:start", undefined);

    await HookExecutor.onBeforeSetup(this.plugins, config);

    const groups = topologicalSort(config.services);

    for (const group of groups) {
      await Promise.all(
        group.map((name) => this.setupService(name, config.services[name])),
      );
    }

    await this.persistState();

    this.eventBus.emit("setup:complete", undefined);
    await HookExecutor.onAllReady(this.plugins);
  }

  async start(config: WorkspaceConfig): Promise<void> {
    this.config = config;

    await HookExecutor.onConfigLoaded(this.plugins, config);

    const groups = topologicalSort(config.services);

    for (const group of groups) {
      await Promise.all(
        group.map((name) => this.startService(name, config.services[name])),
      );
    }

    await this.persistState();

    this.eventBus.emit("all:ready", undefined);
    await HookExecutor.onAllReady(this.plugins);
  }

  /**
   * Load config into the engine without executing setup.
   * Used by commands that need service topology (stop, status) but
   * should NOT trigger git clone / npm install / process start.
   */
  loadConfig(config: WorkspaceConfig): void {
    this.config = config;
    for (const [name, serviceConfig] of Object.entries(config.services)) {
      this.getOrCreateInstance(name, serviceConfig);
    }
  }

  async stop(): Promise<void> {
    if (!this.config) return;

    await HookExecutor.onBeforeStop(this.plugins);

    const groups = topologicalSort(this.config.services);
    const stopGroups = reverseGroups(groups);

    for (const group of stopGroups) {
      await Promise.all(group.map((name) => this.stopService(name)));
    }

    await clearState(this.workspaceDir);
  }

  status(): Map<string, ServiceInstance> {
    return new Map(this.instances);
  }

  private async setupService(
    name: string,
    config: ServiceConfig,
  ): Promise<void> {
    const instance = this.getOrCreateInstance(name, config);
    transition(instance, "setting_up");

    try {
      if (config.type === "process") {
        const proc = config as ProcessServiceConfig;
        if (proc.repo && this.createGitManager) {
          const workdir = proc.workdir
            ? join(this.workspaceDir, proc.workdir)
            : join(this.workspaceDir, name);
          const git = this.createGitManager(
            proc.repo,
            proc.branch ?? "main",
            workdir,
          );
          await git.clone();
        }

        if (proc.setup) {
          const workdir = proc.workdir
            ? join(this.workspaceDir, proc.workdir)
            : join(this.workspaceDir, name);
          await this.runSetupCommand(proc.setup, workdir, this.resolveServiceEnv(proc), name);
        }
      } else if (config.type === "docker") {
        const docker = config as DockerServiceConfig;
        if (this.dockerManager) {
          await this.dockerManager.pullImageIfNeeded(docker.image);
        }
      }

      transition(instance, "ready");
      this.eventBus.emit("service:ready", name);
      await HookExecutor.onServiceReady(this.plugins, name);
    } catch (err) {
      transition(instance, "crashed");
      throw err;
    }
  }

  private async startService(
    name: string,
    config: ServiceConfig,
  ): Promise<void> {
    const instance = this.getOrCreateInstance(name, config);

    if (instance.status === "stopped" || instance.status === "crashed") {
      instance.status = "pending";
    }

    if (instance.status === "pending") {
      transition(instance, "setting_up");
      transition(instance, "ready");
    }

    if (config.type === "process") {
      const proc = config as ProcessServiceConfig;
      const workdir = proc.workdir
        ? join(this.workspaceDir, proc.workdir)
        : join(this.workspaceDir, name);

      mkdirSync(workdir, { recursive: true });

      const { pid } = await this.processManager.start(proc.start, {
        name,
        cwd: workdir,
        env: this.resolveServiceEnv(proc),
      });

      instance.pid = pid;
    } else if (config.type === "docker") {
      const docker = config as DockerServiceConfig;
      if (this.dockerManager && this.config) {
        try {
          await this.dockerManager.startService({
            name,
            serviceConfig: docker,
            workspaceName: this.config.name,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[ws] Docker not available — skipping "${name}". If this service is already running elsewhere, dependent services will connect to it.`);
          transition(instance, "crashed");
          return;
        }
      } else {
        console.warn(`[ws] Docker not available — skipping "${name}". If this service is already running elsewhere, dependent services will connect to it.`);
        transition(instance, "crashed");
        return;
      }
    }

    transition(instance, "running");
    instance.startedAt = new Date();
    this.eventBus.emit("service:ready", name);
    await HookExecutor.onServiceReady(this.plugins, name);
  }

  private async stopService(name: string): Promise<void> {
    const instance = this.instances.get(name);
    if (!instance || instance.status === "stopped") return;

    transition(instance, "stopping");

    if (instance.config.type === "docker") {
      if (this.dockerManager) {
        await this.dockerManager.stopService(name);
      }
    } else if (instance.pid) {
      await this.processManager.stop(instance.pid);
    }

    transition(instance, "stopped");
  }

  private getOrCreateInstance(
    name: string,
    config: ServiceConfig,
  ): ServiceInstance {
    let instance = this.instances.get(name);
    if (!instance) {
      instance = {
        name,
        config,
        status: "pending",
        restartCount: 0,
      };
      this.instances.set(name, instance);
    }
    return instance;
  }

  private async persistState(): Promise<void> {
    if (!this.config) return;

    const serviceStates: Record<string, ServiceState> = {};
    for (const [name, instance] of this.instances) {
      serviceStates[name] = {
        name,
        type: instance.config.type,
        pid: instance.pid,
        status: instance.status,
        startedAt: instance.startedAt?.toISOString(),
      };
    }

    const state: WorkspaceState = {
      version: 1,
      workspaceName: this.config.name,
      services: serviceStates,
      updatedAt: new Date().toISOString(),
    };

    await saveState(this.workspaceDir, state);
  }

  private resolveServiceEnv(config: ServiceConfig): Record<string, string> | undefined {
    if (!config.env_file) return config.env;
    return loadEnvFile(config.env_file, this.workspaceDir, config.env);
  }

  private async runSetupCommand(
    command: string,
    cwd: string,
    env: Record<string, string> | undefined,
    serviceName: string,
  ): Promise<void> {
    const { spawn } = await import("node:child_process");
    await new Promise<void>((resolve, reject) => {
      const shell = process.platform === "win32"
        ? process.env.ComSpec || "cmd.exe"
        : "/bin/sh";
      const shellArgs = process.platform === "win32"
        ? ["/c", command]
        : ["-c", command];
      const child = spawn(shell, shellArgs, {
        cwd,
        env: { ...process.env, ...env },
        stdio: "pipe",
        windowsHide: true,
      });
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Setup command for "${serviceName}" exited with code ${code}`));
      });
      child.on("error", (err) => reject(err));
    });
  }
}
