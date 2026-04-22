import git from "isomorphic-git";
import * as fs from "node:fs";
import * as path from "node:path";

export interface RepoStatus {
  cloned: boolean;
  branch: string;
  dirty: boolean;
  ahead: number;
}

export async function getRepoStatus(dir: string): Promise<RepoStatus> {
  const gitDir = path.join(dir, ".git");

  if (!fs.existsSync(gitDir)) {
    return { cloned: false, branch: "", dirty: false, ahead: 0 };
  }

  const branch =
    (await git.currentBranch({ fs, dir, fullname: false })) ?? "";

  let dirty = false;
  try {
    const matrix = await git.statusMatrix({ fs, dir });
    for (const row of matrix) {
      if (row[1] !== row[2] || row[2] !== row[3]) {
        dirty = true;
        break;
      }
    }
  } catch {
    // statusMatrix can fail on corrupt/empty repos — treat as clean
  }

  let ahead = 0;
  if (branch) {
    try {
      const localOid = await git.resolveRef({ fs, dir, ref: "HEAD" });
      const remoteRef = `refs/remotes/origin/${branch}`;
      const remoteOid = await git.resolveRef({ fs, dir, ref: remoteRef });

      if (localOid !== remoteOid) {
        const commits = await git.log({ fs, dir, ref: localOid });
        const remoteIdx = commits.findIndex((c) => c.oid === remoteOid);
        ahead = remoteIdx === -1 ? commits.length : remoteIdx;
      }
    } catch {
      // remote ref may not exist yet
    }
  }

  return { cloned: true, branch, dirty, ahead };
}
