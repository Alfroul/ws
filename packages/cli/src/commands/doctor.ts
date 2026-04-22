import type { Command } from "commander";
import chalk from "chalk";
import { loadState, clearState, diagnoseState } from "@ws/core";
import { input, select } from "@inquirer/prompts";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose and fix workspace issues")
    .option("--fix", "Automatically fix issues without prompting")
    .action(async (options: { fix?: boolean }) => {
      const workspaceDir = process.cwd();

      try {
        const issues = await diagnoseState(workspaceDir);

        if (issues.length === 0) {
          console.log(chalk.green("✓ Workspace state is consistent. No issues found."));
          return;
        }

        console.log(chalk.yellow(`Found ${issues.length} issue(s):\n`));

        for (const issue of issues) {
          if (issue.type === "zombie_process") {
            console.log(chalk.red(`  × Zombie process: ${issue.message}`));
          } else if (issue.type === "orphan_container") {
            console.log(chalk.red(`  × Orphan container: ${issue.message}`));
          }
        }

        if (options.fix) {
          await clearState(workspaceDir);
          console.log(chalk.green("\n✓ State cleared — all inconsistencies resolved."));
          return;
        }

        const answer = await select({
          message: "How would you like to resolve these issues?",
          choices: [
            { name: "Clear all inconsistent state entries", value: "clear" },
            { name: "Cancel", value: "cancel" },
          ],
        });

        if (answer === "clear") {
          await clearState(workspaceDir);
          console.log(chalk.green("\n✓ State cleared — all inconsistencies resolved."));
        }
      } catch (err) {
        console.error(
          chalk.red(`Error running doctor: ${err instanceof Error ? err.message : err}`),
        );
        process.exit(1);
      }
    });
}
