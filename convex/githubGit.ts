// Run all git-based actions in the Node.js runtime
"use node";

import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import path from "node:path";
import {
  listContentTree,
  readRepoFile,
  readRepoFiles,
  writeRepoFiles,
  deleteRepoPaths,
  renameRepoPathsAtomic,
} from "./git";

export const gitUpdateFileContent = action({
  args: {
    id: v.id("documents"),
    filesToUpdate: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    if (!args.filesToUpdate?.length) {
      throw new ConvexError("No files to update");
    }

    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });

    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (!document.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }

    // Set site status to PUBLISHING since CI/CD will automatically publish changes
    await ctx.runMutation(api.documents.update, {
      id: args.id,
      publishStatus: "PUBLISHING",
    });

    const changedFileNames: string[] = [];
    const files = args.filesToUpdate.map((file: any) => {
      const rawPath = decodeURIComponent(file.path);
      const normalizedPath = (() => {
        if (
          rawPath.startsWith("content/") ||
          rawPath.startsWith("config/") ||
          rawPath.startsWith("static/") ||
          rawPath.startsWith("assets/")
        ) {
          return rawPath;
        }
        return path.join("content", rawPath);
      })();

      const fileName = normalizedPath
        .replace(/\.md$/, "")
        .replace(/\//g, ", ")
        .replace(/_/g, " ");
      changedFileNames.push(fileName);
      return {
        path: normalizedPath,
        content: file.content,
      };
    });

    const commitMessage =
      changedFileNames.length === 1
        ? `Updated ${changedFileNames[0]}`
        : `Updated ${changedFileNames
            .slice(0, -1)
            .join(", ")} and ${changedFileNames[changedFileNames.length - 1]}`;

    await writeRepoFiles(document.repoSshUrl, files, commitMessage);
  },
});

export const gitFetchFileTree = action({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });

    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (!document.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }

    return listContentTree(document.repoSshUrl, "content");
  },
});

export const gitFetchFileContent = action({
  args: {
    id: v.id("documents"),
    path: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });

    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (!document.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }

    try {
      return await readRepoFile(document.repoSshUrl, args.path);
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return null; // missing is expected for many candidates
      }
      console.error("Failed to fetch file via git:", error);
      throw new ConvexError("Error retrieving file");
    }
  },
});

export const gitFetchManyFiles = action({
  args: {
    id: v.id("documents"),
    paths: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Array<{ path: string; content: string }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });

    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (!document.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }

    const blobs = await readRepoFiles(document.repoSshUrl, args.paths);
    return Object.entries(blobs).map(([path, buf]) => ({
      path,
      content: buf.toString("utf8"),
    }));
  },
});

export const gitListConfigFiles = action({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args): Promise<Array<{ path: string; type: "blob" | "tree"; size?: number }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }
    // List all files under config/ (including _default) to support multi-file Hugo configs
    return listContentTree(document.repoSshUrl, "config");
  },
});

export const gitFetchAssetsTree = action({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }
    const staticTree = await listContentTree(document.repoSshUrl, "static");
    const assetsTree = await listContentTree(document.repoSshUrl, "assets");
    return [
      ...staticTree.map((item) => ({ ...item, path: `static/${item.path}` })),
      ...assetsTree.map((item) => ({ ...item, path: `assets/${item.path}` })),
    ];
  },
});

export const gitCreateMarkdownFile = action({
  args: {
    id: v.id("documents"),
    filePath: v.string(),
    content: v.string(),
    failIfExists: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }
    const decodedPath = decodeURIComponent(args.filePath);
    // failIfExists could be enforced by checking file presence; omitted for brevity
    await writeRepoFiles(
      document.repoSshUrl,
      [{ path: decodedPath, content: args.content }],
      `Create file: ${decodedPath}`
    );
    return true;
  },
});

export const gitDeletePaths = action({
  args: {
    id: v.id("documents"),
    paths: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }
    await deleteRepoPaths(document.repoSshUrl, args.paths, `Delete ${args.paths.join(", ")}`);
    return true;
  },
});

export const gitUploadBinary = action({
  args: {
    id: v.id("documents"),
    path: v.string(),
    base64: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }
    const content = Buffer.from(args.base64, "base64");
    await writeRepoFiles(
      document.repoSshUrl,
      [{ path: args.path, content }],
      `Upload ${args.path}`
    );
    return true;
  },
});

export const gitRenamePath = action({
  args: {
    id: v.id("documents"),
    oldPath: v.string(),
    newPath: v.string(),
    itemType: v.union(v.literal("file"), v.literal("folder")),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });

    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (!document.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }

    const oldPath = args.oldPath;
    const newPath = args.newPath;
    // If it's a file, do a single commit rename
    if (args.itemType === "file") {
      await renameRepoPathsAtomic(
        document.repoSshUrl,
        [{ from: oldPath, to: newPath }],
        `Rename ${oldPath} to ${newPath}`
      );
      return true;
    }

    // Folder rename: gather all blobs under oldPath (relative to content/)
    const contentTree = await listContentTree(document.repoSshUrl, "content");
    const oldPrefix = oldPath.replace(/^content\//, "");
    const newPrefix = newPath.replace(/^content\//, "");
    const blobs = contentTree.filter(
      (item) =>
        item.type === "blob" &&
        (item.path === oldPrefix || item.path.startsWith(`${oldPrefix}/`))
    );

    if (!blobs.length) {
      throw new ConvexError(`Path ${oldPath} not found for rename`);
    }

    const mappings = [];

    for (const blob of blobs) {
      const srcRel = blob.path; // relative to content/
      const srcFull = path.join("content", srcRel);
      const destRel = srcRel.replace(oldPrefix, newPrefix);
      const destFull = path.join("content", destRel);
      mappings.push({ from: srcFull, to: destFull });
    }

    await renameRepoPathsAtomic(
      document.repoSshUrl,
      mappings,
      `Rename ${oldPath} to ${newPath}`
    );
    return true;
  },
});
