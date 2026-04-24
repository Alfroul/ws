import chalk from "chalk";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const SERVICE_COLORS = [
  chalk.cyan,
  chalk.green,
  chalk.yellow,
  chalk.magenta,
  chalk.blue,
  chalk.red,
  chalk.white,
];

export function getServiceColor(index: number): typeof chalk.cyan {
  return SERVICE_COLORS[index % SERVICE_COLORS.length];
}

export function formatLine(serviceName: string, line: string, colorFn: typeof chalk.cyan): string {
  return `${colorFn(`[${serviceName}]`)} ${line}`;
}

export interface LogFileInfo {
  name: string;
  path: string;
}

export function getLogFiles(logDir: string, service?: string): LogFileInfo[] {
  if (!existsSync(logDir)) return [];

  if (service) {
    const logPath = resolve(logDir, `${service}.log`);
    if (!existsSync(logPath)) return [];
    return [{ name: service, path: logPath }];
  }

  const files: LogFileInfo[] = [];
  for (const entry of readdirSync(logDir)) {
    if (!entry.endsWith(".log")) continue;
    const filePath = resolve(logDir, entry);
    if (!statSync(filePath).isFile()) continue;
    const serviceName = entry.slice(0, -".log".length);
    files.push({ name: serviceName, path: filePath });
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}
