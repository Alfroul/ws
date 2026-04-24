import type { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { load as yamlLoad } from "js-yaml";
import {
  loadState,
  clearState,
  diagnoseState,
  detectPortConflicts,
  fixStaleState,
} from "@alfroul/core";
import type { ServiceConfig } from "@alfroul/config";
import { select } from "@inquirer/prompts";

async function loadServiceConfigs(workspaceDir: string): Promise<Record<string, ServiceConfig>> {
  const yamlPath = resolve(workspaceDir, "workspace.yaml");
  const raw = await readFile(yamlPath, "utf-8");
  const config = yamlLoad(raw) as Record<string, unknown>;

  if (!config.services || typeof config.services !== "object") {
    return {};
  }

  return config.services as Record<string, ServiceConfig>;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose and fix workspace issues")
    .option("--fix", "Automatically fix issues without prompting")
    .action(async (options: { fix?: boolean }) => {
      const workspaceDir = process.cwd();

      try {
        let issues = await diagnoseState(workspaceDir);

        let serviceConfigs: Record<string, ServiceConfig> = {};
        try {
          serviceConfigs = await loadServiceConfigs(workspaceDir);
          const portIssues = await detectPortConflicts(workspaceDir, serviceConfigs);
          issues = [...issues, ...portIssues];
        } catch {
          // workspace.yaml not found — skip port conflict detection
        }

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
          } else if (issue.type === "stale_state") {
            console.log(chalk.red(`  × Stale state: ${issue.message}`));
          } else if (issue.type === "port_conflict") {
            console.log(chalk.yellow(`  ⚠ Port conflict: ${issue.message}`));
          }
        }

        if (options.fix) {
          const fixed = await fixStaleState(workspaceDir);
          if (fixed.length > 0) {
            console.log(
              chalk.green(`\n✓ Fixed ${fixed.length} stale state entries: ${fixed.join(", ")}`),
            );
          }

          const remaining = await diagnoseState(workspaceDir);
          if (remaining.length > 0) {
            await clearState(workspaceDir);
            console.log(chalk.green("✓ State cleared — remaining inconsistencies resolved."));
          }
          return;
        }

        const answer = await select({
          message: "How would you like to resolve these issues?",
          choices: [
            { name: "Fix stale state entries, then clear remaining if needed", value: "fix" },
            { name: "Clear all inconsistent state entries", value: "clear" },
            { name: "Cancel", value: "cancel" },
          ],
        });

        if (answer === "fix") {
          const fixed = await fixStaleState(workspaceDir);
          if (fixed.length > 0) {
            console.log(
              chalk.green(`\n✓ Fixed ${fixed.length} stale state entries: ${fixed.join(", ")}`),
            );
          }

          const remaining = await diagnoseState(workspaceDir);
          if (remaining.length > 0) {
            await clearState(workspaceDir);
            console.log(chalk.green("✓ State cleared — remaining inconsistencies resolved."));
          }
        } else if (answer === "clear") {
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
