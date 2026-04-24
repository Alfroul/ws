import type { Command } from "commander";
import chalk from "chalk";
import { loadConfig, createEngine } from "./setup.js";
import { watchFile } from "node:fs";
import { createReadStream, readFileSync, unwatchFile } from "node:fs";
import { createInterface } from "node:readline";
import { getServiceColor, formatLine, getLogFiles } from "./logs-helper.js";

async function dumpLogFiles(
  files: Array<{ name: string; path: string }>,
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const { name, path } = files[i];
    const colorFn = getServiceColor(i);
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      if (line === "") continue;
      console.log(formatLine(name, line, colorFn));
    }
  }
}

async function tailLogFiles(
  files: Array<{ name: string; path: string }>,
): Promise<void> {
  if (files.length === 0) {
    console.error(chalk.red("No log files found."));
    process.exit(1);
  }

  const { statSync: statSyncFn } = await import("node:fs");
  const filePositions = new Map<string, number>();
  for (const { path } of files) {
    const stat = statSyncFn(path);
    filePositions.set(path, stat.size);
  }

  const colorMap = new Map<string, typeof chalk.cyan>();
  files.forEach((f, i) => colorMap.set(f.name, getServiceColor(i)));

  for (const { name, path } of files) {
    const colorFn = colorMap.get(name)!;

    watchFile(path, { interval: 500 }, (curr) => {
      const prev = filePositions.get(path) ?? 0;
      if (curr.size <= prev) {
        filePositions.set(path, curr.size);
        return;
      }

      const stream = createReadStream(path, { start: prev, encoding: "utf-8" });
      const rl = createInterface({ input: stream });
      rl.on("line", (line) => {
        console.log(formatLine(name, line, colorFn));
      });
      rl.on("close", () => {
        filePositions.set(path, curr.size);
      });
    });
  }

  console.log(chalk.gray("Tailing logs... (Ctrl+C to stop)"));
  process.on("SIGINT", () => {
    for (const { path } of files) {
      unwatchFile(path);
    }
    process.exit(0);
  });

  await new Promise<void>(() => {});
}

export function registerLogsCommand(program: Command): void {
  program
    .command("logs [service]")
    .description("Show service logs")
    .option("--tail, -f", "Follow log output in real time")
    .option("-c, --config <path>", "Path to workspace.yaml")
    .action(async (service?: string, options?: { tail?: boolean; f?: boolean; config?: string }) => {
      try {
        const { configDir } = await loadConfig(options?.config);
        const { processManager } = createEngine(configDir);
        const logDir = processManager.getLogDir();

        const files = getLogFiles(logDir, service);

        if (files.length === 0) {
          const msg = service
            ? `No logs found for service: ${service}`
            : "No log files found. Start services with `ws start` first.";
          console.error(chalk.red(msg));
          process.exit(1);
        }

        if (!service && files.length > 1) {
          const names = files.map((f) => f.name).join(", ");
          console.log(chalk.gray(`Services: ${names}\n`));
        }

        const follow = options?.tail || options?.f;

        if (follow) {
          await tailLogFiles(files);
        } else {
          await dumpLogFiles(files);
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
