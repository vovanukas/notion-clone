"use node";

import { ConvexError, v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import sodium from 'libsodium-wrappers';
import { api } from "./_generated/api";
import { createClerkClient } from "@clerk/backend";
import { Id } from "./_generated/dataModel";
import { cleanupWorkdir, gitCommitAndPush, setupGitRepo } from "./git";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

function attachRateLimitLogging(octokit: Octokit) {
  octokit.hook.after("request", (response, options) => {
    const headers = response.headers || {};
    const remaining = headers["x-ratelimit-remaining"];
    const limit = headers["x-ratelimit-limit"];
    const used = (headers as any)["x-ratelimit-used"];
    const reset = headers["x-ratelimit-reset"];
    const url = (options as any).url;
    console.log(
      `[octokit] ${options.method} ${url} -> ${response.status} rate ${remaining}/${limit} used ${used ?? "?"} reset ${reset ?? "?"}`
    );
  });
}

export const completeOnboarding = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    try {
      await clerkClient.users.updateUser(identity.subject, {
        publicMetadata: {
          onboardingComplete: true,
        },
      });
      
      return { success: true };
    } catch (error) {
      console.error("Error updating user metadata:", error);
      throw new ConvexError("Failed to update onboarding status");
    }
  },
});

// getUserOctokit removed; all operations use git or app Octokit

async function getAppOctokit(ctx: ActionCtx, documentId: Id<"documents">) {
  // Check user authentication
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }

  // Check document authorization
  const document = await ctx.runQuery(api.documents.getById, { documentId });
  if (!document) {
    throw new ConvexError("Document not found");
  }

  if (document.userId !== identity.subject) {
    throw new ConvexError("Not authorized to access this document");
  }

  // Get GitHub App authentication
  const base64Key = process.env.GITHUB_PRIVATE_KEY_BASE64;
  if (!base64Key) {
    throw new ConvexError("GitHub App not properly configured");
  }

  try {
    const privateKey = Buffer.from(base64Key, 'base64').toString('utf8');

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey,
        installationId: process.env.GITHUB_INSTALLATION_ID!,
      }
    });
    attachRateLimitLogging(octokit);
    return octokit;
  } catch (error) {
    console.error("GitHub App authentication error:", error);
    throw new ConvexError("Failed to initialize GitHub client");
  }
}



export const createRepo = action({
  args: { 
    repoName: v.id("documents"),
    siteName: v.string(),
    templateRepo: v.string(),
   },
  handler: async (ctx, args) => {
    console.log("Creating repo from template...");
    console.log("Site Name:", args.siteName);
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error ("Unauthenticated");
    }

    ctx.runMutation(api.documents.update, {
      id: args.repoName,
      buildStatus: "BUILDING",
      title: args.siteName,
    })

    const octokit = await getAppOctokit(ctx, args.repoName);
    try {
      // 1. Create repository from template
      const response = await octokit.repos.createUsingTemplate({
        template_owner: "vovanukas",
        template_repo: args.templateRepo,
        owner: "hugity",
        name: args.repoName,
        private: false,
        description: args.siteName,
        include_all_branches: false
      });

      const repoUrl = response.data.html_url;
      console.log("Repository created from template:", repoUrl);

      // 2. Run independent tasks in parallel
      await Promise.all([
        // TASK A: Secrets (Required for the deploy.yml that comes with the template)
        (async () => {
          // Fetch key ONCE
          const { data: publicKey } = await octokit.rest.actions.getRepoPublicKey({
            owner: 'hugity',
            repo: args.repoName,
          });

          await sodium.ready;
          const binkey = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL);

          // Helper to encrypt and upload
          const uploadSecret = async (name: string, value: string) => {
            const binsec = sodium.from_string(value);
            const encBytes = sodium.crypto_box_seal(binsec, binkey);
            const encrypted_value = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

            return octokit.rest.actions.createOrUpdateRepoSecret({
              owner: 'hugity',
              repo: args.repoName,
              secret_name: name,
              encrypted_value,
              key_id: publicKey.key_id,
            });
          };

          // Upload secrets in parallel
          await Promise.all([
            uploadSecret('CALLBACK_BEARER', identity.subject),
            uploadSecret('WORKFLOW_TOKEN', process.env.GITHUB_TOKEN!),
            uploadSecret('CONVEX_SITE_URL', process.env.CONVEX_SITE_URL!)
          ]);
        })(),

        // TASK C: GitHub Pages Setup
        (async () => {
          await octokit.repos.createPagesSite({
            owner: "hugity",
            repo: args.repoName,
            build_type: "workflow",
          });

          await octokit.repos.updateInformationAboutPagesSite({
            owner: "hugity",
            repo: args.repoName,
            https_enforced: true,
          });
        })(),

      ]);

      // Store repo URL for git operations (HTTPS)
      await ctx.runMutation(api.documents.update, {
        id: args.repoName,
        repoSshUrl: `https://github.com/hugity/${args.repoName}.git`,
      } as any);

      // 3. Post-creation cleanup and trigger

      // Mark provisioning as complete
      await ctx.runMutation(api.documents.update, {
        id: args.repoName,
        buildStatus: "BUILT",
        publishStatus: "PUBLISHING",
      });

      // Trigger initial deployment manually to ensure it runs WITH the secrets we just added
      // (The auto-trigger from creation might fail or run before secrets were available)
      try {
        const { data: workflows } = await octokit.actions.listRepoWorkflows({
          owner: "hugity",
          repo: args.repoName,
        });

        const deployWorkflow = workflows.workflows.find(w =>
          w.name.toLowerCase().includes('deploy') ||
          w.path.includes('deploy') ||
          w.name.toLowerCase().includes('hugo')
        );

        if (deployWorkflow) {
          await octokit.actions.createWorkflowDispatch({
            owner: "hugity",
            repo: args.repoName,
            workflow_id: deployWorkflow.id,
            ref: "main",
            inputs: {
              callbackUrl: process.env.CONVEX_SITE_URL! + "/callbackPageDeployed",
            }
          });
          console.log("Triggered initial deployment workflow:", deployWorkflow.name);
        }
      } catch (dispatchError) {
        console.warn("Failed to trigger initial deployment:", dispatchError);
        // Non-fatal, user can trigger manually later or next push will handle it
      }

      return repoUrl;
    } catch (error) {
      console.error("Error creating repository or adding workflow:", error);
      throw new Error("Failed to create repository from template");
    }
  },
});

export const publishPage = action({
  args: { 
    id:v.id("documents"),
   },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error ("Unauthenticated");
    }

    const octokit = await getAppOctokit(ctx, args.id);

    ctx.runMutation(api.documents.update, {
      id: args.id,
      publishStatus: "PUBLISHING",
    })

    await ctx.runAction(api.github.encryptAndPublishSecret, ({
      id: args.id,
      secret: identity.subject,
      secretName: 'CALLBACK_BEARER'
    }))

    await ctx.runAction(api.github.encryptAndPublishSecret, ({
        id: args.id,
        secret: process.env.CONVEX_SITE_URL!,
        secretName: 'CONVEX_SITE_URL'
      }))

    try {
      // Try git push to trigger workflow via push event
      const document = await ctx.runQuery(api.documents.getById, {
        documentId: args.id,
      });

      let gitPushSucceeded = false;
      if (document?.repoSshUrl) {
        const workdir = `/tmp/repo-${args.id}-${Date.now()}`;
        try {
          await setupGitRepo(document.repoSshUrl, workdir);
          const triggerPath = ".hugity-publish-trigger";
          const content = `publish-trigger ${new Date().toISOString()}`;
          await import("node:fs/promises").then(fs =>
            fs.writeFile(`${workdir}/${triggerPath}`, content, "utf8")
          );
          await gitCommitAndPush(workdir, "Trigger publish");
          gitPushSucceeded = true;
        } catch (gitError) {
          console.warn("Git push publish trigger failed, will fall back to workflow dispatch:", gitError);
        } finally {
          await cleanupWorkdir(workdir);
        }
      }

      if (gitPushSucceeded) {
        return;
      }

      // If git push failed or no repo URL, ensure Pages is enabled via app octokit
      try {
        await octokit.repos.getPages({
          owner: "hugity",
          repo: args.id
        });
        console.log("GitHub Pages already enabled");
      } catch (error: any) {
        if (error.status === 404) {
          console.log("GitHub Pages not enabled, creating...");
          try {
            await octokit.repos.createPagesSite({
              owner: "hugity",
              repo: args.id,
              build_type: "workflow",
            });

            await octokit.repos.updateInformationAboutPagesSite({
              owner: "hugity",
              repo: args.id,
              https_enforced: true,
            });

            console.log("GitHub Pages site created successfully");
          } catch (createError) {
            console.error("Failed to create GitHub Pages site:", createError);
            throw new Error("Failed to enable GitHub Pages. Please try again.");
          }
        } else {
          console.error("Error checking GitHub Pages status:", error);
          throw error;
        }
      }
    } catch (error) {
      console.error("Error during publish fallback:", error);
      throw error;
    }
  },
});

export const unpublishPage = action({
  args: {
    id: v.id("documents"),
   },
  handler: async (ctx, args) => {
    const octokit = await getAppOctokit(ctx, args.id);

    try {
      // Update document status to unpublishing
      await ctx.runMutation(api.documents.update, {
        id: args.id,
        publishStatus: "PUBLISHING", // Use PUBLISHING as a temporary status during unpublish
      });

      // Delete the GitHub Pages site using the official API endpoint
      await octokit.repos.deletePagesSite({
        owner: "hugity",
        repo: args.id,
      });

      // Update document status to unpublished after successful deletion
      await ctx.runMutation(api.documents.update, {
        id: args.id,
        publishStatus: "UNPUBLISHED",
        websiteUrl: undefined, // Clear the website URL since it's no longer accessible
      });

      return true;
    } catch (error) {
      console.error("Error unpublishing page:", error);

      // Update status to error if unpublishing fails
      await ctx.runMutation(api.documents.update, {
        id: args.id,
        publishStatus: "ERROR",
      });

      throw new Error("Failed to unpublish page");
    }
  },
});

// dispatchDeployWorkflow removed; pushes to main trigger deploy

export const getPagesUrl = action({
  args: {
    id: v.id("documents"),
    callbackUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const octokit = await getAppOctokit(ctx, args.id);

    try {
      // Add retries for getting Pages information
      let retries = 3;
      let delay = 2000; // Start with 2 second delay

      while (retries > 0) {
        try {
          const pagesInformation = await octokit.repos.getPages({
            owner: "hugity",
            repo: args.id
          });

          return pagesInformation.data.html_url;
        } catch (error: any) {
          if (error.status === 404 && retries > 1) {
            // Only wait and retry if we have retries left
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay *= 2; // Exponential backoff
            continue;
          }
          throw error; // Rethrow if it's not a 404 or we're out of retries
        }
      }

      // If we get here, we've run out of retries
      console.log("GitHub Pages site not ready after retries");
      return undefined;
    } catch (error) {
      console.error("Error getting GitHub Pages URL:", error);
      return undefined; // Return undefined instead of throwing
    }
  }
});

export const encryptAndPublishSecret = action({
  args: { 
    id: v.id("documents"),
    secret: v.string(),
    secretName: v.string(),
   },
  handler: async (ctx, args) => {
    const octokit = await getAppOctokit(ctx, args.id);

    const publicGithubKey = await octokit.rest.actions.getRepoPublicKey({
      owner: 'hugity',
      repo: args.id,
    });

    const output = await sodium.ready.then(async () => {
      // Convert the secret and key to a Uint8Array.
      const binkey = sodium.from_base64(publicGithubKey.data.key, sodium.base64_variants.ORIGINAL);
      const binsec = sodium.from_string(args.secret);

      // Encrypt the secret using libsodium
      const encBytes = sodium.crypto_box_seal(binsec, binkey);

      // Convert the encrypted Uint8Array to Base64
      const output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

      // Set as repo secret
      return output;
    });

    await octokit.rest.actions.createOrUpdateRepoSecret({
      owner: 'hugity',
      repo: args.id,
      secret_name: args.secretName,
      encrypted_value: output,
      key_id: publicGithubKey.data.key_id,
    });
    },
});

export const fetchAndReturnGithubFileContent = action({
  args: {
    id: v.id("documents"),
    path: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });

    if (document?.repoSshUrl) {
      console.log(
        `[fetchAndReturnGithubFileContent] Using git path for repo ${document.repoSshUrl}, file ${args.path}`
      );
      const content = await ctx.runAction(api.githubGit.gitFetchFileContent, {
        id: args.id,
        path: args.path,
      });
      if (content === null) {
        throw new ConvexError("File not found");
      }
      return content;
    }

    throw new ConvexError("Repository URL not configured for git fetch");
  },
});

export const fetchAllConfigFiles = action({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args): Promise<Array<{content:string;path:string;name:string;isDirectory:boolean}>> => {
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }
    // Collect possible config files: root configs + any under config/ (including _default)
    const candidates = new Set<string>([
      "config.toml",
      "config.yaml",
      "config.yml",
      "config.json",
      "hugo.toml",
      "hugo.yaml",
      "hugo.yml",
      "hugo.json",
    ]);

    // Include any files discovered under config/ and config/_default
    try {
      const configTree = await ctx.runAction(api.githubGit.gitListConfigFiles, {
        id: args.id,
      });
      for (const entry of configTree) {
        if (
          entry.type === "blob" &&
          (entry.path.endsWith(".toml") ||
            entry.path.endsWith(".yaml") ||
            entry.path.endsWith(".yml") ||
            entry.path.endsWith(".json"))
        ) {
          candidates.add(`config/${entry.path}`);
        }
      }
    } catch (err) {
      console.warn("Failed to list config directory, continuing with root candidates", err);
    }

    const batch = await ctx.runAction(api.githubGit.gitFetchManyFiles, {
      id: args.id,
      paths: Array.from(candidates),
    });

    return batch.map((file) => ({
      content: file.content,
      path: file.path,
      name: file.path,
      isDirectory: false,
    })); // may be empty if no configs present
  },
  });

export const fetchConfigFile = action({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{content:string;path:string;name:string}> => {
    const configFiles = ["config.toml", "config.yaml", "config.yml", "config.json", "hugo.toml", "hugo.yaml", "hugo.yml", "hugo.json"];
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }

    for (const configFile of configFiles) {
      try {
        const content = await ctx.runAction(api.githubGit.gitFetchFileContent, {
          id: args.id,
          path: configFile,
        });
        if (content !== null) {
          return {
            content,
            path: configFile,
            name: configFile,
          };
        }
      } catch {
        continue;
      }
    }
    throw new Error("No configuration file found (tried .toml, .yaml, .yml, .json)");
  },
});

export const parseAndSaveSettingsObject = action({
  args: {
    id: v.id("documents"),
    newSettings: v.string(),
    configPath: v.string(), // Added configPath
  },
  handler: async (ctx, args) => {
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

    // Set site status to PUBLISHING since CI/CD will automatically publish changes
    await ctx.runMutation(api.documents.update, {
      id: args.id,
      publishStatus: "PUBLISHING",
    });

    await ctx.runAction(api.githubGit.gitUpdateFileContent, {
      id: args.id,
      filesToUpdate: [
        {
          // Normalize to keep configs under config/, never content/config
          path: args.configPath
            .replace(/^content\/config\//, "config/")
            .replace(/^content\/_default\//, "config/_default/"),
          content: args.newSettings,
        },
      ],
    });
  }
});

export const parseAndSaveMultipleConfigFiles = action({
  args: {
    id: v.id("documents"),
    configFiles: v.array(v.object({
      content: v.string(),
      path: v.string(),
      name: v.string(),
      isDirectory: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
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

    // Set site status to PUBLISHING since CI/CD will automatically publish changes
    await ctx.runMutation(api.documents.update, {
      id: args.id,
      publishStatus: "PUBLISHING",
    });

    try {
      await ctx.runAction(api.githubGit.gitUpdateFileContent, {
        id: args.id,
        filesToUpdate: args.configFiles.map(file => ({
          // Normalize to keep configs under config/, never content/config
          path: file.path
            .replace(/^content\/config\//, "config/")
            .replace(/^content\/_default\//, "config/_default/"),
          content: file.content,
        })),
      });

      return args.configFiles.map(file => ({
        success: true,
        path: file.path
      }));

    } catch (error) {
      console.error("Failed to update config files:", error);
      throw new Error("Failed to update configuration files. Please try again.");
    }
  }
});

export const fetchGitHubFileTree = action({
  args: {
    id: v.id("documents")
  },
  handler: async (ctx, args): Promise<any> => {
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (document?.repoSshUrl) {
      console.log(
        `[fetchGitHubFileTree] Using git path for repo ${document.repoSshUrl}`
      );
      return ctx.runAction(api.githubGit.gitFetchFileTree, { id: args.id });
    }

    throw new ConvexError("Repository URL not configured");
  }
});

export const updateFileContent = action({
  args: {
    id: v.id("documents"),
    filesToUpdate: v.any(),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });

    if (args.filesToUpdate.length === 0) {
      throw new Error("No files to update");
    }

    let repoUrl = document?.repoSshUrl;
    if (!repoUrl) {
      repoUrl = `https://github.com/hugity/${args.id}.git`;
      await ctx.runMutation(api.documents.update, {
        id: args.id,
        repoSshUrl: repoUrl,
      } as any);
    }

    // Set site status to PUBLISHING since CI/CD will automatically publish changes
    await ctx.runMutation(api.documents.update, {
      id: args.id,
      publishStatus: "PUBLISHING",
    });

    console.log(
      `[updateFileContent] Using git path for repo ${repoUrl}`
    );
    return ctx.runAction(api.githubGit.gitUpdateFileContent, {
      id: args.id,
      filesToUpdate: args.filesToUpdate,
    });
  }
});

export const uploadImage = action({
  args: {
    id: v.id("documents"),
    file: v.string(),
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    await ctx.runAction(api.githubGit.gitUploadBinary, {
      id: args.id,
      path: `static/images/${args.filename}`,
      base64: args.file,
    });
    return true;
  }
});

export const deleteRepo = action({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const userId = identity.subject;

    const existingDocument = await ctx.runQuery(api.documents.getById, { documentId: args.id });

    if (!existingDocument) {
      throw new Error("Not found");
    }

    if (existingDocument.userId !== userId) {
      throw new Error ("Unauthorized");
    }

    const octokit = await getAppOctokit(ctx, args.id);

    try {
      await octokit.repos.delete({
        owner: 'hugity',
        repo: args.id,
      });
    } catch (error) {
      console.error("Failed to delete GitHub repository:", error);
      throw new Error("Failed to delete GitHub repository");
    }
  }
});

export const deleteImage = action({
  args: {
    id: v.id("documents"),
    imagePath: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(api.githubGit.gitDeletePaths, {
      id: args.id,
      paths: [`static/${args.imagePath}`],
    });
    return true;
  }
});

export const createMarkdownFileInRepo = action({
  args: {
    id: v.id("documents"),
    filePath: v.string(), // e.g. content/en/about/_index.md or content/en/about/page.md
    content: v.string(),  // markdown content (frontmatter + body)
    failIfExists: v.optional(v.boolean()), // If true, throws error if file already exists
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }
    await ctx.runAction(api.githubGit.gitCreateMarkdownFile, {
      id: args.id,
      filePath: args.filePath,
      content: args.content,
      failIfExists: args.failIfExists,
    });
    return true;
  },
});

export const deleteFile = action({
  args: {
    id: v.id("documents"),
    filePath: v.string(), // This is the top-level path to delete (file or directory)
  },
  handler: async (ctx, args) => {
    await ctx.runAction(api.githubGit.gitDeletePaths, {
      id: args.id,
      paths: [args.filePath],
    });
    return true;
  },
});

export const renamePathInRepo = action({
  args: {
    id: v.id("documents"),
    oldPath: v.string(),
    newPath: v.string(),
    itemType: v.union(v.literal("file"), v.literal("folder")),
  },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }
    await ctx.runAction(api.githubGit.gitRenamePath, {
      id: args.id,
      oldPath: args.oldPath,
      newPath: args.newPath,
      itemType: args.itemType,
    });
    return true;
  },
});

export const fetchAssetsTree = action({
  args: {
    id: v.id("documents")
  },
  handler: async (ctx, args): Promise<any[]> => {
    const document = await ctx.runQuery(api.documents.getById, {
      documentId: args.id,
    });
    if (!document?.repoSshUrl) {
      throw new ConvexError("Repository URL not configured");
    }
    return ctx.runAction(api.githubGit.gitFetchAssetsTree, { id: args.id });
  }
});

export const deleteAsset = action({
  args: {
    id: v.id("documents"),
    filePath: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(api.githubGit.gitDeletePaths, {
      id: args.id,
      paths: [args.filePath],
    });
    return true;
  }
});