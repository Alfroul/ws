import git from "isomorphic-git";
import * as fs from "node:fs";
import * as http from "isomorphic-git/http/node";
import { cloneRepo, type CloneOptions } from "./clone.js";
import { pullRepo } from "./pull.js";
import { getRepoStatus, type RepoStatus as RepoStatusType } from "./status.js";

export type RepoStatus = RepoStatusType;

export class GitManager {
  constructor(
    private repo: string,
    private branch: string,
    private workdir: string,
  ) {}

  async clone(onProgress?: (percent: number) => void): Promise<void> {
    try {
      const result = await cloneRepo({
        repo: this.repo,
        dir: this.workdir,
        branch: this.branch,
        onProgress,
      });
      if (result === "skipped") {
        return;
      }
    } catch (error: unknown) {
      throw wrapGitError(error, "clone");
    }
  }

  async pull(): Promise<void> {
    try {
      await pullRepo({
        dir: this.workdir,
        ref: this.branch,
        fastForwardOnly: true,
      });
    } catch (error: unknown) {
      throw wrapGitError(error, "pull");
    }
  }

  async status(): Promise<RepoStatus> {
    try {
      return await getRepoStatus(this.workdir);
    } catch (error: unknown) {
      throw wrapGitError(error, "status");
    }
  }

  async checkout(targetBranch: string): Promise<void> {
    try {
      const branches = await git.listBranches({ fs, dir: this.workdir });

      if (!branches.includes(targetBranch)) {
        const remoteBranches = await git.listBranches({
          fs,
          dir: this.workdir,
          remote: "origin",
        });

        if (remoteBranches.includes(targetBranch)) {
          await git.branch({
            fs,
            dir: this.workdir,
            ref: targetBranch,
            object: `origin/${targetBranch}`,
          });
        } else {
          throw new Error(
            `Branch "${targetBranch}" not found locally or on remote.`,
          );
        }
      }

      await git.checkout({ fs, dir: this.workdir, ref: targetBranch });
      this.branch = targetBranch;
    } catch (error: unknown) {
      throw wrapGitError(error, "checkout");
    }
  }
}

function wrapGitError(error: unknown, operation: string): Error {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("enotfound") ||
      msg.includes("econnrefused") ||
      msg.includes("network")
    ) {
      return new Error(
        `Git ${operation} failed: network error — ${error.message}`,
      );
    }
    if (msg.includes("401") || msg.includes("403") || msg.includes("auth")) {
      return new Error(
        `Git ${operation} failed: authentication error — ${error.message}`,
      );
    }
    if (msg.includes("enospc") || msg.includes("no space left")) {
      return new Error(
        `Git ${operation} failed: disk space insufficient — ${error.message}`,
      );
    }
    return new Error(`Git ${operation} failed: ${error.message}`);
  }
  return new Error(`Git ${operation} failed with unknown error`);
}
