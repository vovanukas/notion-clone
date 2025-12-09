"use node";

import { mkdir, rm, stat, writeFile, readFile, readdir, rename as fsRename } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { createAppAuth } from "@octokit/auth-app";

/**
 * Get a GitHub App installation access token for git HTTPS auth.
 */
async function getInstallationToken(): Promise<string> {
  const privateKeyBase64 = process.env.GITHUB_PRIVATE_KEY_BASE64;
  if (!privateKeyBase64) {
    throw new Error("GITHUB_PRIVATE_KEY_BASE64 missing");
  }
  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf8");
  const auth = createAppAuth({
    appId: process.env.GITHUB_APP_ID!,
    privateKey,
    installationId: process.env.GITHUB_INSTALLATION_ID!,
  });
  const res = await auth({ type: "installation" });
  return res.token;
}

/**
 * Clone a repo via HTTPS using GitHub App installation token.
 */
export async function setupGitRepo(
  repoUrl: string,
  workdir: string
): Promise<void> {
  const token = await getInstallationToken();
  await mkdir(workdir, { recursive: true });
  await git.clone({
    fs,
    http,
    dir: workdir,
    url: repoUrl,
    ref: "main",
    singleBranch: true,
    depth: 1,
    onAuth: () => ({ username: "x-access-token", password: token }),
  });
}

/**
 * Stage, commit, and push all changes in workdir.
 * Skips commit if no changes are present.
 */
export async function gitCommitAndPush(
  workdir: string,
  message: string
): Promise<void> {
  const token = await getInstallationToken();

  const status = await git.statusMatrix({ fs, dir: workdir });
  const hasChanges = status.some(([, head, worktree, stage]) => head !== worktree || worktree !== stage);
  if (!hasChanges) {
    return;
  }

  // Explicitly stage deletions before add
  const deletions = status
    .filter(([, head, worktree]) => head !== 0 && worktree === 0)
    .map(([filepath]) => filepath);

  for (const filepath of deletions) {
    await git.remove({ fs, dir: workdir, filepath });
  }

  await git.add({ fs, dir: workdir, filepath: "." });
  await git.commit({
    fs,
    dir: workdir,
    message,
    author: { name: "Hugity Bot", email: "bot@hugity.com" },
  });

  try {
    await git.push({
      fs,
      http,
      dir: workdir,
      remote: "origin",
      ref: "main",
      onAuth: () => ({ username: "x-access-token", password: token }),
    });
  } catch (error: any) {
    if (error?.code === "PushRejectedError") {
      console.warn("Push rejected (non fast-forward). Retrying with force.");
      await git.push({
        fs,
        http,
        dir: workdir,
        remote: "origin",
        ref: "main",
        force: true,
        onAuth: () => ({ username: "x-access-token", password: token }),
      });
    } else {
      throw error;
    }
  }
}

export async function cleanupWorkdir(workdir: string) {
  await rm(workdir, { recursive: true, force: true });
}

export async function readRepoFile(
  repoUrl: string,
  filePath: string
): Promise<string> {
  const workdir = tmpWorkdir(repoUrl);
  try {
    await setupGitRepo(repoUrl, workdir);
    const absPath = path.join(workdir, filePath);
    return await readFile(absPath, "utf8");
  } finally {
    await cleanupWorkdir(workdir);
  }
}

export async function readRepoFiles(
  repoUrl: string,
  filePaths: string[]
): Promise<Record<string, Buffer>> {
  const workdir = tmpWorkdir(repoUrl);
  const out: Record<string, Buffer> = {};
  try {
    await setupGitRepo(repoUrl, workdir);
    for (const filePath of filePaths) {
      const absPath = path.join(workdir, filePath);
      try {
        const data = await readFile(absPath);
        out[filePath] = data;
      } catch (err: any) {
        if (err?.code === "ENOENT") continue;
        throw err;
      }
    }
    return out;
  } finally {
    await cleanupWorkdir(workdir);
  }
}

export async function writeRepoFiles(
  repoUrl: string,
  files: Array<{ path: string; content: string | Buffer }>,
  commitMessage: string
) {
  const workdir = tmpWorkdir(repoUrl);
  try {
    await setupGitRepo(repoUrl, workdir);
    for (const file of files) {
      const absPath = path.join(workdir, file.path);
      await mkdir(path.dirname(absPath), { recursive: true });
      await writeFile(absPath, file.content);
    }
    await gitCommitAndPush(workdir, commitMessage);
  } finally {
    await cleanupWorkdir(workdir);
  }
}

export async function deleteRepoPaths(
  repoUrl: string,
  pathsToDelete: string[],
  commitMessage: string
) {
  const workdir = tmpWorkdir(repoUrl);
  try {
    await setupGitRepo(repoUrl, workdir);
    for (const rel of pathsToDelete) {
      const abs = path.join(workdir, rel);
      await rm(abs, { recursive: true, force: true });
    }
    await gitCommitAndPush(workdir, commitMessage);
  } finally {
    await cleanupWorkdir(workdir);
  }
}

type RenameMapping = { from: string; to: string };

/**
 * Rename paths (files) in a single commit.
 * 'from' and 'to' are repo-root relative paths.
 */
export async function renameRepoPathsAtomic(
  repoUrl: string,
  mappings: RenameMapping[],
  commitMessage: string
) {
  const workdir = tmpWorkdir(repoUrl);
  try {
    await setupGitRepo(repoUrl, workdir);

    // Atomic fs-level renames (move) per mapping
    for (const m of mappings) {
      const absFrom = path.join(workdir, m.from);
      const absTo = path.join(workdir, m.to);
      await mkdir(path.dirname(absTo), { recursive: true });
      await fsRename(absFrom, absTo);
    }

    await gitCommitAndPush(workdir, commitMessage);
  } finally {
    await cleanupWorkdir(workdir);
  }
}

export async function renameRepoPath(
  repoUrl: string,
  oldPath: string,
  newPath: string,
  commitMessage: string
) {
  const workdir = tmpWorkdir(repoUrl);
  try {
    await setupGitRepo(repoUrl, workdir);
    const absOld = path.join(workdir, oldPath);
    const absNew = path.join(workdir, newPath);
    await mkdir(path.dirname(absNew), { recursive: true });
    await fs.promises.rename(absOld, absNew);
    await gitCommitAndPush(workdir, commitMessage);
  } finally {
    await cleanupWorkdir(workdir);
  }
}

export async function listContentTree(
  repoUrl: string,
  root = "content"
) {
  const workdir = tmpWorkdir(repoUrl);
  try {
    await setupGitRepo(repoUrl, workdir);
    const contentDir = path.join(workdir, root);
    try {
      const rootStat = await stat(contentDir);
      if (!rootStat.isDirectory()) {
        return [];
      }
    } catch (err: any) {
      if (err?.code === "ENOENT") return [];
      throw err;
    }
    return await walk(contentDir, "");
  } finally {
    await cleanupWorkdir(workdir);
  }
}

function tmpWorkdir(repoUrl: string) {
  const safe = Buffer.from(repoUrl).toString("hex").slice(0, 12);
  return `/tmp/repo-${safe}-${Date.now()}`;
}

async function walk(baseDir: string, rel: string) {
  const full = path.join(baseDir, rel);
  const entries = await readdir(full, { withFileTypes: true });
  const out: Array<{ path: string; type: "blob" | "tree"; size?: number }> = [];
  for (const entry of entries) {
    const entryPath = path.join(rel, entry.name);
    const abs = path.join(baseDir, entryPath);
    if (entry.isDirectory()) {
      out.push({ path: entryPath, type: "tree" });
      out.push(...(await walk(baseDir, entryPath)));
    } else if (entry.isFile()) {
      const s = await stat(abs);
      out.push({ path: entryPath, type: "blob", size: s.size });
    }
  }
  return out;
}
