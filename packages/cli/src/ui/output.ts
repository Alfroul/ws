import chalk from "chalk";

export interface GlobalOptions {
  json?: boolean;
  verbose?: boolean;
}

export interface CommandResult {
  success: boolean;
  command: string;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export function outputResult(
  options: GlobalOptions,
  result: CommandResult,
): void {
  if (options.json) {
    const output: Record<string, unknown> = {
      success: result.success,
      command: result.command,
    };
    if (result.message) output.message = result.message;
    if (result.error) output.error = result.error;
    if (result.data) Object.assign(output, result.data);
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (result.success) {
    console.log(
      chalk.green(result.message ?? `✓ ${result.command} complete`),
    );
  } else {
    console.error(chalk.red(result.error ?? `${result.command} failed`));
  }
}
