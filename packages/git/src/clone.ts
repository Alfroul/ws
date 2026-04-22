import git from "isomorphic-git";
import * as fs from "node:fs";
import * as http from "isomorphic-git/http/node";
import * as path from "node:path";

export interface CloneOptions {
  repo: string;
  dir: string;
  branch?: string;
  onProgress?: (percent: number) => void;
}

export async function cloneRepo(options: CloneOptions): Promise<"cloned" | "skipped"> {
  const { repo, dir, branch, onProgress } = options;

  const gitDir = path.join(dir, ".git");
  if (fs.existsSync(gitDir)) {
    return "skipped";
  }

  await fs.promises.mkdir(dir, { recursive: true });

  await git.clone({
    fs,
    http,
    dir,
    url: repo,
    ref: branch,
    singleBranch: true,
    depth: undefined,
    onProgress: onProgress
      ? (event: { phase?: string; loaded?: number; total?: number }) => {
          if (event.total && event.total > 0) {
            onProgress(Math.min(event.loaded! / event.total, 1));
          }
        }
      : undefined,
  });

  return "cloned";
}
