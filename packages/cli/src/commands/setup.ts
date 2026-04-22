import type { Command } from "commander";
import chalk from "chalk";
import { parseConfig } from "@ws/config";
import { WorkspaceEngine } from "@ws/core";
import { ProcessManager } from "@ws/process";
import { DockerManager } from "@ws/docker";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { outputResult } from "../ui/output.js";
import type { GlobalOptions } from "../ui/output.js";

export function createEngine(workspaceDir?: string): {
  engine: WorkspaceEngine;
  processManager: ProcessManager;
  dockerManager: DockerManager;
} {
  const dir = workspaceDir ?? process.cwd();
  const processManager = new ProcessManager({
    logDir: resolve(dir, ".ws/logs"),
  });
  const dockerManager = new DockerManager();
  const engine = new WorkspaceEngine({
    processManager,
    dockerManager,
    workspaceDir: dir,
  });
  return { engine, processManager, dockerManager };
}

export async function loadConfig(
  configPath?: string,
  globalOpts?: GlobalOptions,
) {
  const path = configPath ?? resolve(process.cwd(), "workspace.yaml");
  if (!existsSync(path)) {
    if (globalOpts?.json) {
      console.log(
        JSON.stringify({
          success: false,
          command: "config",
          error: `Config file not found: ${path}`,
        }),
      );
    } else {
      console.error(chalk.red(`Config file not found: ${path}`));
      console.error(chalk.gray('Run "ws init" to create one.'));
    }
    process.exit(1);
  }
  return parseConfig(path);
}

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Set up all services (clone repos, run setup commands)")
    .option("-c, --config <path>", "Path to workspace.yaml")
    .action(async (options: { config?: string }) => {
      const globalOpts: GlobalOptions = program.opts();
      try {
        const config = await loadConfig(options.config, globalOpts);
        const { engine } = createEngine();

        if (!globalOpts.json) {
          console.log(chalk.cyan(`Setting up workspace: ${config.name}`));
        }
        await engine.setup(config);
        outputResult(globalOpts, {
          success: true,
          command: "setup",
          message: "✓ Setup complete",
          data: { workspace: config.name },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        outputResult(globalOpts, {
          success: false,
          command: "setup",
          error: `Setup failed: ${message}`,
        });
        if (globalOpts.verbose && err instanceof Error && err.stack) {
          console.error(chalk.gray(err.stack));
        }
        process.exit(1);
      }
    });
}
