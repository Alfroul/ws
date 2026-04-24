import type { Command } from "commander";
import chalk from "chalk";
import { loadConfig, createEngine } from "./setup.js";
import { outputResult } from "../ui/output.js";
import type { GlobalOptions } from "../ui/output.js";

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Start all services")
    .option("-c, --config <path>", "Path to workspace.yaml")
    .action(async (options: { config?: string }) => {
      const globalOpts: GlobalOptions = program.opts();
      try {
        const { config, configDir } = await loadConfig(options.config, globalOpts);
        const { engine } = createEngine(configDir);

        if (!globalOpts.json) {
          console.log(chalk.cyan(`Starting workspace: ${config.name}`));
        }
        await engine.start(config);
        outputResult(globalOpts, {
          success: true,
          command: "start",
          message: "✓ All services started",
          data: { workspace: config.name },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        outputResult(globalOpts, {
          success: false,
          command: "start",
          error: `Start failed: ${message}`,
        });
        if (globalOpts.verbose && err instanceof Error && err.stack) {
          console.error(chalk.gray(err.stack));
        }
        process.exit(1);
      }
    });
}
