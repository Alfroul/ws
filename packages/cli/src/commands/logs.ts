import type { Command } from "commander";
import chalk from "chalk";
import { createEngine } from "./setup.js";
import { existsSync } from "node:fs";

export function registerLogsCommand(program: Command): void {
  program
    .command("logs [service]")
    .description("Show service logs")
    .action(async (service?: string) => {
      try {
        if (!service) {
          console.error(chalk.red("Please specify a service name."));
          process.exit(1);
        }

        const { processManager } = createEngine();
        const logPath = processManager.getLogPath(service);

        if (!existsSync(logPath)) {
          console.error(chalk.red(`No logs found for service: ${service}`));
          process.exit(1);
        }

        const { createReadStream } = await import("node:fs");
        const { createInterface } = await import("node:readline");

        const stream = createReadStream(logPath, { encoding: "utf-8" });
        const rl = createInterface({ input: stream });

        for await (const line of rl) {
          console.log(line);
        }
      } catch (err) {
        console.error(
          chalk.red(
            `Logs failed: ${err instanceof Error ? err.message : err}`,
          ),
        );
        process.exit(1);
      }
    });
}
