import type { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "./setup.js";
import { outputResult } from "../ui/output.js";
import type { GlobalOptions } from "../ui/output.js";
import type { WorkspaceConfig } from "@alfroul/config";
import { loadState } from "@alfroul/core";

const STATUS_ICONS: Record<string, string> = {
  pending: chalk.gray("○"),
  setting_up: chalk.yellow("⟳"),
  ready: chalk.blue("●"),
  running: chalk.green("●"),
  stopping: chalk.yellow("◎"),
  stopped: chalk.gray("○"),
  crashed: chalk.red("✗"),
};

async function displayStatus(
  config: WorkspaceConfig,
  workspaceDir: string,
  globalOpts: GlobalOptions,
): Promise<void> {
  const state = await loadState(workspaceDir);

  const serviceEntries = Object.entries(config.services);

  if (serviceEntries.length === 0) {
    outputResult(globalOpts, {
      success: true,
      command: "status",
      message: "No services configured.",
      data: { workspace: config.name, services: {} },
    });
    return;
  }

  if (globalOpts.json) {
    const services: Record<string, { status: string; pid: number | null }> = {};
    for (const [name, svcConfig] of serviceEntries) {
      const svcState = state.services[name];
      services[name] = {
        status: svcState?.status ?? "stopped",
        pid: svcState?.pid ?? null,
      };
    }
    outputResult(globalOpts, {
      success: true,
      command: "status",
      data: { workspace: config.name, services },
    });
    return;
  }

  console.log(chalk.bold(`\nWorkspace: ${config.name}\n`));

  const nameWidth = Math.max(
    ...serviceEntries.map(([n]) => n.length),
    4,
  );
  const statusWidth = 12;

  console.log(
    chalk.bold(
      `  ${"Name".padEnd(nameWidth)}   ${"Status".padEnd(statusWidth)}   PID`,
    ),
  );
  console.log(
    `  ${"─".repeat(nameWidth)}   ${"─".repeat(statusWidth)}   ${"─".repeat(7)}`,
  );

  for (const [name, svcConfig] of serviceEntries) {
    const svcState = state.services[name];
    const statusValue = svcState?.status ?? "stopped";
    const icon = STATUS_ICONS[statusValue] ?? chalk.gray("?");
    const statusText = `${icon} ${statusValue}`;
    const pid = svcState?.pid?.toString() ?? "-";
    console.log(
      `  ${name.padEnd(nameWidth)}   ${statusText.padEnd(statusWidth + 2)}   ${pid}`,
    );
  }

  console.log();
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show status of all services")
    .option("-c, --config <path>", "Path to workspace.yaml")
    .option("--watch", "Auto-refresh status every 2 seconds")
    .action(async (options: { config?: string; watch?: boolean }) => {
      const globalOpts: GlobalOptions = program.opts();
      try {
        const config = await loadConfig(options.config, globalOpts);
        const workspaceDir = process.cwd();

        await displayStatus(config, workspaceDir, globalOpts);

        if (options.watch && !globalOpts.json) {
          const interval = setInterval(async () => {
            console.clear();
            await displayStatus(config, workspaceDir, globalOpts);
          }, 2000);

          process.on("SIGINT", () => {
            clearInterval(interval);
            process.exit(0);
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        outputResult(globalOpts, {
          success: false,
          command: "status",
          error: `Status failed: ${message}`,
        });
        if (globalOpts.verbose && err instanceof Error && err.stack) {
          console.error(chalk.gray(err.stack));
        }
        process.exit(1);
      }
    });
}
