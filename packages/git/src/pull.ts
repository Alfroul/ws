import git from "isomorphic-git";
import * as fs from "node:fs";
import * as http from "isomorphic-git/http/node";

export interface PullOptions {
  dir: string;
  ref?: string;
  fastForwardOnly?: boolean;
}

export interface PullResult {
  alreadyUpToDate: boolean;
}

export async function pullRepo(options: PullOptions): Promise<PullResult> {
  const { dir, ref, fastForwardOnly = true } = options;

  const dirty = await isDirty(dir);
  if (dirty) {
    throw new Error(
      "Working tree has uncommitted changes. Commit or stash them before pulling.",
    );
  }

  const fetchResult = await git.fetch({
    fs,
    http,
    dir,
    ref,
    singleBranch: true,
  });

  const headOid = await git.resolveRef({ fs, dir, ref: "HEAD" });
  const remoteOid = fetchResult.fetchHead;

  if (headOid === remoteOid) {
    return { alreadyUpToDate: true };
  }

  await git.pull({
    fs,
    http,
    dir,
    ref,
    singleBranch: true,
    fastForwardOnly,
    author: {
      name: "ws",
      email: "ws@localhost",
    },
  });

  return { alreadyUpToDate: false };
}

/** isomorphic-git statusMatrix row indices: [filepath, Head, Workdir, Stage] */
export async function isDirty(dir: string): Promise<boolean> {
  const matrix = await git.statusMatrix({ fs, dir });
  for (const row of matrix) {
    const head = row[1];
    const workdir = row[2];
    const stage = row[3];
    if (head !== workdir || workdir !== stage) {
      return true;
    }
  }
  return false;
}
