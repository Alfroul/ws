#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { registerInitCommand } from "./commands/init.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerStartCommand } from "./commands/start.js";
import { registerStopCommand } from "./commands/stop.js";
import { registerStatusCommand } from "./commands/status.js";
import { registerAddCommand } from "./commands/add.js";
import { registerRemoveCommand } from "./commands/remove.js";
import { registerLogsCommand } from "./commands/logs.js";
import { registerShellCommand } from "./commands/shell.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerCompletionCommand } from "./commands/completion.js";

const program = new Command();

program
  .name("ws")
  .description("Developer workspace manager")
  .version("0.1.0")
  .option("--verbose", "Enable verbose logging")
  .option("--json", "Output in JSON format");

registerInitCommand(program);
registerSetupCommand(program);
registerStartCommand(program);
registerStopCommand(program);
registerStatusCommand(program);
registerAddCommand(program);
registerRemoveCommand(program);
registerLogsCommand(program);
registerShellCommand(program);
registerDoctorCommand(program);
registerCompletionCommand(program);

// Global error handling
process.on("uncaughtException", (error: Error) => {
  console.error(chalk.red("Unexpected error occurred."));
  if (program.opts().verbose) {
    console.error(chalk.gray(error.stack ?? error.message));
  } else {
    console.error(chalk.gray("Run with --verbose for details."));
  }
  console.error(
    chalk.gray(
      "Please report this issue: https://github.com/Alfroul/ws/issues",
    ),
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error(chalk.red("Unexpected error occurred."));
  if (program.opts().verbose) {
    console.error(chalk.gray(String(reason)));
  } else {
    console.error(chalk.gray("Run with --verbose for details."));
  }
  process.exit(1);
});

program.parse();

if (process.argv.length <= 2) {
  console.log(chalk.cyan("ws — Developer Workspace Manager"));
  console.log(chalk.gray("Run `ws --help` to see available commands.\n"));
}
