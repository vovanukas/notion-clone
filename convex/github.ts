"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { Octokit } from "@octokit/rest";
import sodium from 'libsodium-wrappers';
import { api } from "./_generated/api";
import matter from "gray-matter";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const createRepo = action({
  args: { 
    repoName: v.id("documents"),
    siteName: v.string(),
    siteTemplate: v.string(),
   },
  handler: async (ctx, args) => {
    console.log("Creating repo...");
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

    try {
      // Step 1: Create a new repository in the organization
      const response = await octokit.repos.createInOrg({
        org: "hugotion",
        name: args.repoName,
        private: false,
        description: "Hugo site repository",
      });

      const repoUrl = response.data.html_url;
      console.log("Repository created:", repoUrl);

      await ctx.runAction(api.github.encryptAndPublishSecret, ({
        id: args.repoName,
        secret: identity.subject,
        secretName: 'CALLBACK_BEARER'
      }))

      await ctx.runAction(api.github.encryptAndPublishSecret, ({
        id: args.repoName,
        secret: process.env.GITHUB_TOKEN!,
        secretName: 'WORKFLOW_TOKEN'
      }))



      // Step 2: Add a GitHub Actions workflow to set up Hugo
      const workflowContent = `
name: Setup Hugo

on: 
  push:
    branches:
      - main

jobs:
  setup-hugo:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        token: \${{ secrets.WORKFLOW_TOKEN }}

    - name: Configure Git user
      run: |
        git config --global user.name "GitHub Actions"
        git config --global user.email "actions@github.com"

    - name: Clone and extract site
      run: |
        # Create a temporary directory
        TEMP_DIR=$(mktemp -d)
        # Clone the sites repository
        git clone https://github.com/vovanukas/hugo-sites.git $TEMP_DIR
        # Copy the specific site contents
        cp -r $TEMP_DIR/${args.siteTemplate}/* .
        cp -r $TEMP_DIR/${args.siteTemplate}/.* . 2>/dev/null || true
        # Clean up
        rm -rf $TEMP_DIR

    - name: Delete Workflow File
      run: |
        rm .github/workflows/hugo-setup.yml

    - name: Commit and push changes
      env:
        GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      run: |
        git add .
        git commit -m "Initial setup with ${args.siteTemplate} site"
        git push https://x-access-token:\${{ secrets.GITHUB_TOKEN }}@github.com/hugotion/\${{ github.event.repository.name }}.git main

    - name: Notify on success
      if: success()
      uses: distributhor/workflow-webhook@v3
      with:
        webhook_url: 'https://cool-pelican-27.convex.site/callbackPageDeployed'
        webhook_auth_type: "bearer"
        webhook_auth: \${{ secrets.CALLBACK_BEARER }}
        data: '{ "buildStatus": "BUILT", "publishStatus": "UNPUBLISHED" }'

    - name: Notify on failure
      if: failure()
      uses: distributhor/workflow-webhook@v3
      with:
        webhook_url: 'https://cool-pelican-27.convex.site/callbackPageDeployed'
        webhook_auth_type: "bearer"
        webhook_auth: \${{ secrets.CALLBACK_BEARER }}
        data: '{ "buildStatus": "ERROR", "publishStatus": "ERROR" }'
`;

      // Commit the workflow file to the repository
      await octokit.repos.createOrUpdateFileContents({
        owner: "hugotion", // Replace with your org name
        repo: args.repoName, // Use the dynamic repo name
        path: ".github/workflows/hugo-setup.yml",
        message: "Add Hugo setup workflow",
        content: Buffer.from(workflowContent).toString("base64"), // Encode to base64
      });

      await octokit.repos.createPagesSite({
        owner: "hugotion",
        repo: args.repoName,
        build_type: "workflow",
      })

      return repoUrl;
    } catch (error) {
      console.error("Error creating repository or adding workflow:", error);
      throw new Error("Failed to create repository and set up workflow");
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

    ctx.runMutation(api.documents.update, {
      id: args.id,
      publishStatus: "PUBLISHING",
    })

    await ctx.runAction(api.github.encryptAndPublishSecret, ({
      id: args.id,
      secret: identity.subject,
      secretName: 'CALLBACK_BEARER'
    }))

    try {
      // First try to find any existing deployment workflow files
      const workflowFiles = await octokit.repos.getContent({
        owner: "hugotion",
        repo: args.id,
        path: ".github/workflows"
      });

      let hasDeployWorkflow = false;
      if (!Array.isArray(workflowFiles.data)) {
        throw new Error("Expected directory content");
      }

      // Check for any workflow file that might handle deployments
      for (const file of workflowFiles.data) {
        if (file.type === "file" && 
            file.name.includes("deploy")) {
          hasDeployWorkflow = true;
          // Try to dispatch this workflow
          try {
            await octokit.actions.createWorkflowDispatch({
              owner: "hugotion",
              repo: args.id,
              workflow_id: file.name,
              ref: "main",
            });
            return; // Successfully dispatched existing workflow
          } catch (dispatchError) {
            console.warn(`Failed to dispatch workflow ${file.name}:`, dispatchError);
            // Continue checking other files if dispatch fails
          }
        }
      }

      // If no suitable workflow found, create our default one
      if (!hasDeployWorkflow) {
        const deployWorkflowContent = `
name: GitHub Pages

on:
  push:
    branches:
      - main  # Set a branch name to trigger deployment
  workflow_dispatch:

jobs:
  deploy:
    environment:
      name: github-pages
    runs-on: ubuntu-22.04
    permissions:
      contents: read
      pages: write
      id-token: write
    concurrency:
      group: \${{ github.workflow }}-\${{ github.ref }}
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive  # Fetch Hugo themes (true OR recursive)
          fetch-depth: 0    # Fetch all history for .GitInfo and .Lastmod

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: '0.128.0'
          extended: true

      - name: Build
        run: hugo --minify

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

      - name: Notify on success
        if: success()
        uses: distributhor/workflow-webhook@v3
        with:
          webhook_url: 'https://cool-pelican-27.convex.site/callbackPageDeployed'
          webhook_auth_type: "bearer"
          webhook_auth: \${{ secrets.CALLBACK_BEARER }}
          data: '{ "buildStatus": "BUILT", "publishStatus": "PUBLISHED" }'

      - name: Notify on failure
        if: failure()
        uses: distributhor/workflow-webhook@v3
        with:
          webhook_url: 'https://cool-pelican-27.convex.site/callbackPageDeployed'
          webhook_auth_type: "bearer"
          webhook_auth: \${{ secrets.CALLBACK_BEARER }}
          data: '{ "buildStatus": "BUILT", "publishStatus": "ERROR" }'`;
    
        await octokit.repos.createOrUpdateFileContents({
          owner: "hugotion",
          repo: args.id,
          path: ".github/workflows/deploy.yml",
          message: "Add Hugo setup workflow",
          content: Buffer.from(deployWorkflowContent).toString("base64"),
        });
      }
    } catch (error) {
      if (!(error instanceof Error && error instanceof Object && 'status' in error)) {
        console.error(error)
        return
      }

      if (error.status === 404) {
        // Handle case where .github/workflows directory doesn't exist
        const deployWorkflowContent = `
name: GitHub Pages

on:
  push:
    branches:
      - main  # Set a branch name to trigger deployment
  workflow_dispatch:

jobs:
  deploy:
    environment:
      name: github-pages
    runs-on: ubuntu-22.04
    permissions:
      contents: read
      pages: write
      id-token: write
    concurrency:
      group: \${{ github.workflow }}-\${{ github.ref }}
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive  # Fetch Hugo themes (true OR recursive)
          fetch-depth: 0    # Fetch all history for .GitInfo and .Lastmod

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: '0.128.0'
          extended: true

      - name: Build
        run: hugo --minify

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

      - name: Notify on success
        if: success()
        uses: distributhor/workflow-webhook@v3
        with:
          webhook_url: 'https://cool-pelican-27.convex.site/callbackPageDeployed'
          webhook_auth_type: "bearer"
          webhook_auth: \${{ secrets.CALLBACK_BEARER }}
          data: '{ "buildStatus": "BUILT", "publishStatus": "PUBLISHED" }'

      - name: Notify on failure
        if: failure()
        uses: distributhor/workflow-webhook@v3
        with:
          webhook_url: 'https://cool-pelican-27.convex.site/callbackPageDeployed'
          webhook_auth_type: "bearer"
          webhook_auth: \${{ secrets.CALLBACK_BEARER }}
          data: '{ "buildStatus": "BUILT", "publishStatus": "ERROR" }'`;
        await octokit.repos.createOrUpdateFileContents({
          owner: "hugotion",
          repo: args.id,
          path: ".github/workflows/deploy.yml",
          message: "Add Hugo setup workflow",
          content: Buffer.from(deployWorkflowContent).toString("base64"),
        });
      }
    }
  },
});

export const dispatchDeployWorkflow = action({
  args: {
    id: v.id("documents"),
  },
  handler: async (_, args) => {
    await octokit.actions.createWorkflowDispatch({
      owner: "hugotion",
      repo: args.id,
      workflow_id: "deploy.yml",
      ref: "main",
    });
  },
});

export const getPagesUrl = action({
  args: { id:v.id("documents") },
  handler: async (_, args) => {
    const pagesInformation = await octokit.repos.getPages({
      owner: "hugotion",
      repo: args.id
    })
    
    return pagesInformation.data.html_url;
  }
});

export const encryptAndPublishSecret = action({
  args: { 
    id: v.id("documents"),
    secret: v.string(),
    secretName: v.string(),
   },
  handler: async (ctx, args) => {
    const publicGithubKey = await octokit.rest.actions.getRepoPublicKey({
      owner: 'hugotion',
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
      owner: 'hugotion',
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
  handler: async (ctx, args) => {
    try {
      const response = await octokit.repos.getContent({
        owner: 'hugotion',
        repo: args.id,
        path: args.path,
      });
      if ('content' in response.data && typeof response.data.content === 'string') {
        const base64DecodedContent = Buffer.from(response.data.content, 'base64').toString('utf8');

        return base64DecodedContent;
      } else {
        throw new Error("Invalid file content or format");
      }
    } catch (error) {
      console.error(`Failed to fetch ${args.path}:`, error);
      throw new Error(`Error retrieving ${args.path} file`);
    }
  },
});

export const fetchAllConfigFiles = action({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const configFiles: Array<{
      content: string;
      path: string;
      name: string;
      isDirectory: boolean;
    }> = [];

    // First, try to find single config files in the root directory
    const rootConfigFiles = [
      "config.toml", "config.yaml", "config.yml", "config.json", 
      "hugo.toml", "hugo.yaml", "hugo.yml", "hugo.json"
    ];

    for (const configFile of rootConfigFiles) {
      try {
        const response = await octokit.repos.getContent({
          owner: "hugotion",
          repo: args.id,
          path: configFile,
        });
        if ("content" in response.data && typeof response.data.content === "string") {
          const base64DecodedContent = Buffer.from(response.data.content, "base64").toString("utf8");
          configFiles.push({
            content: base64DecodedContent,
            path: configFile,
            name: configFile,
            isDirectory: false,
          });
        }
      } catch (error: any) {
        if (error.status !== 404) {
          console.error(`Failed to fetch ${configFile}:`, error);
        }
        // Continue to next file if 404 or other error
      }
    }

    // Then, try to find config directory structure
    try {
      const configDirResponse = await octokit.repos.getContent({
        owner: "hugotion",
        repo: args.id,
        path: "config",
      });

      if (Array.isArray(configDirResponse.data)) {
        // It's a directory, fetch all files recursively
        const configDirFiles = await fetchConfigDirectoryFiles(args.id, "config", configDirResponse.data);
        configFiles.push(...configDirFiles);
      }
    } catch (error: any) {
      if (error.status !== 404) {
        console.error("Failed to fetch config directory:", error);
      }
      // Config directory doesn't exist, which is fine
    }

    if (configFiles.length === 0) {
      throw new Error("No configuration files found (tried root config files and config directory)");
    }

    return configFiles;
  },
  });

export const fetchConfigFile = action({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const configFiles = ["config.toml", "config.yaml", "config.yml", "config.json", "hugo.toml", "hugo.yaml", "hugo.yml", "hugo.json"];
    for (const configFile of configFiles) {
      try {
        const response = await octokit.repos.getContent({
          owner: "hugotion",
          repo: args.id,
          path: configFile,
        });
        if ("content" in response.data && typeof response.data.content === "string") {
          const base64DecodedContent = Buffer.from(response.data.content, "base64").toString("utf8");
          return {
            content: base64DecodedContent,
            path: configFile,
            name: configFile, // Or extract just the name if needed
          };
        }
      } catch (error: any) {
        if (error.status === 404) {
          // File not found, try next one
          continue;
        }
        // Other error
        console.error(`Failed to fetch ${configFile}:`, error);
        throw new Error(`Error retrieving configuration file ${configFile}`);
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
  handler: async (_, args) => {
    const contentResponse = await octokit.repos.getContent({
      owner: "hugotion",
      repo: args.id,
      path: args.configPath, // Use dynamic configPath
    });

    if (!Array.isArray(contentResponse.data) && contentResponse.data.type === 'file') {
      const { sha } = contentResponse.data;

      const updatedConfig = args.newSettings;

      await octokit.repos.createOrUpdateFileContents({
        owner: "hugotion",
        repo: args.id,
        path: args.configPath, // Use dynamic configPath
        message: `Changed config settings in ${args.configPath}`,
        content: Buffer.from(updatedConfig).toString("base64"),
        sha,
      });
    } else {
      throw new Error("The path is not a file or does not exist.");
    }
  }
});

// Helper function to recursively fetch files from config directory
async function fetchConfigDirectoryFiles(repoId: string, dirPath: string, dirContents: any[]): Promise<Array<{
  content: string;
  path: string;
  name: string;
  isDirectory: boolean;
}>> {
  const files: Array<{
    content: string;
    path: string;
    name: string;
    isDirectory: boolean;
  }> = [];

  for (const item of dirContents) {
    if (item.type === "file" && (
      item.name.endsWith(".toml") || 
      item.name.endsWith(".yaml") || 
      item.name.endsWith(".yml") || 
      item.name.endsWith(".json")
    )) {
      try {
        const response = await octokit.repos.getContent({
          owner: "hugotion",
          repo: repoId,
          path: item.path,
        });
        if ("content" in response.data && typeof response.data.content === "string") {
          const base64DecodedContent = Buffer.from(response.data.content, "base64").toString("utf8");
          files.push({
            content: base64DecodedContent,
            path: item.path,
            name: item.name,
            isDirectory: true,
          });
        }
      } catch (error: any) {
        console.error(`Failed to fetch config file ${item.path}:`, error);
      }
    } else if (item.type === "dir") {
      // Recursively fetch from subdirectories
      try {
        const subDirResponse = await octokit.repos.getContent({
          owner: "hugotion",
          repo: repoId,
          path: item.path,
        });
        if (Array.isArray(subDirResponse.data)) {
          const subDirFiles = await fetchConfigDirectoryFiles(repoId, item.path, subDirResponse.data);
          files.push(...subDirFiles);
        }
      } catch (error: any) {
        console.error(`Failed to fetch config subdirectory ${item.path}:`, error);
      }
    }
  }

  return files;
}

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
  handler: async (_, args) => {
    const results = [];
    
    for (const configFile of args.configFiles) {
      try {
        const contentResponse = await octokit.repos.getContent({
          owner: "hugotion",
          repo: args.id,
          path: configFile.path,
        });

        if (!Array.isArray(contentResponse.data) && contentResponse.data.type === 'file') {
          const { sha } = contentResponse.data;

          await octokit.repos.createOrUpdateFileContents({
            owner: "hugotion",
            repo: args.id,
            path: configFile.path,
            message: `Changed config settings in ${configFile.path}`,
            content: Buffer.from(configFile.content).toString("base64"),
            sha,
          });

          results.push({ success: true, path: configFile.path });
        } else {
          results.push({ success: false, path: configFile.path, error: "The path is not a file or does not exist." });
        }
      } catch (error: any) {
        results.push({ success: false, path: configFile.path, error: error.message });
      }
    }

    return results;
  }
});

export const fetchGitHubFileTree = action({
  args: {
    id: v.id("documents")
  },
  handler: async (_, args) => {
    try {
      // Step 1: Get the entire tree of the main branch
      const { data: mainTree } = await octokit.git.getTree({
        owner: "hugotion",
        repo: args.id,
        tree_sha: "main",
        recursive: "false", // Fetch only the top-level directories
      });

      // Step 2: Find the SHA of the "content" folder
      const contentFolder = mainTree.tree.find((item: any) =>
        item.path === "content" && item.type === "tree"
      );

      if (!contentFolder || !contentFolder.sha) {
        throw new Error("Content folder not found");
      }

      // Step 3: Fetch the tree for the "content" directory using the SHA
      const { data: contentTree } = await octokit.git.getTree({
        owner: "hugotion",
        repo: args.id,
        tree_sha: contentFolder.sha,
        recursive: "true", // Now we fetch inside the content folder
      });
      return contentTree.tree;
    } catch (error) {
      console.error("Error fetching GitHub content folder tree:", error);
      throw new Error("Failed to fetch GitHub content folder tree");
    }
  }
});

export const updateFileContent = action({
  args: {
    id: v.id("documents"),
    filesToUpdate: v.any(),
  },
  handler: async (_, args) => {
    if (args.filesToUpdate.length === 0) {
      throw new Error("No files to update");
    }

    try {
      // Get the current commit SHA and tree SHA
      const { data: ref } = await octokit.git.getRef({
        owner: "hugotion",
        repo: args.id,
        ref: "heads/main",
      });

      const currentCommitSha = ref.object.sha;
      const { data: currentCommit } = await octokit.git.getCommit({
        owner: "hugotion",
        repo: args.id,
        commit_sha: currentCommitSha,
      });

      const currentTreeSha = currentCommit.tree.sha;

      // Prepare tree changes
      const treeChanges: Array<{
        path: string;
        mode: "100644" | "100755" | "040000" | "160000" | "120000";
        type: "blob" | "tree" | "commit";
        content: string;
      }> = [];
      const changedFileNames = [];

      for (const file of args.filesToUpdate) {
        const { content, path, sha, ...metadata } = file;  // Extract sha separately

        // Clean up the file name for the commit message
        const fileName = path.replace(/\.md$/, '').replace(/\//g, ', ').replace(/_/g, ' ');
        changedFileNames.push(fileName);

        // Create the frontmatter string (without sha)
        const frontmatter = matter.stringify(content, metadata);

        // Add to tree changes
        treeChanges.push({
          path: `content/${path}`,
          mode: "100644" as const,
          type: "blob" as const,
          content: frontmatter,
        });
      }

      // Create new tree with all changes
      const { data: newTree } = await octokit.git.createTree({
        owner: "hugotion",
        repo: args.id,
        base_tree: currentTreeSha,
        tree: treeChanges,
      });

      // Generate commit message
      const commitMessage = changedFileNames.length === 1
        ? `Updated ${changedFileNames[0]}`
        : `Updated ${changedFileNames.slice(0, -1).join(', ')} and ${changedFileNames[changedFileNames.length - 1]}`;

      // Create new commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: "hugotion",
        repo: args.id,
        message: commitMessage,
        tree: newTree.sha,
        parents: [currentCommitSha],
      });

      // Update the main branch reference
      await octokit.git.updateRef({
        owner: "hugotion",
        repo: args.id,
        ref: "heads/main",
        sha: newCommit.sha,
      });

      console.log(`Successfully updated ${args.filesToUpdate.length} files in a single commit: ${commitMessage}`);

    } catch (error) {
      console.error("Failed to update files:", error);
      throw new Error("Failed to update files. Please try again.");
    }
  }
});

export const uploadImage = action({
  args: {
    id: v.id("documents"),
    file: v.string(),
    filename: v.string(),
  },
  handler: async (_, args) => {
    try {
      const response = await octokit.repos.createOrUpdateFileContents({
        owner: 'hugotion',
        repo: args.id,
        path: `static/images/${args.filename}`,
        message: 'Uploaded image',
        content: args.file,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      return response.data;
    } catch (error) {
      console.error("Failed to upload image:", error);
      throw new Error("Failed to upload image. Please try again.");
    }
  }
});

export const deleteRepo = action({
  args: { id: v.id("documents") },
  handler: async (_, args) => {
    try {
      await octokit.repos.delete({
        owner: 'hugotion',
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
  handler: async (_, args) => {
    try {
      console.log("Attempting to delete image:", {
        repo: args.id,
        path: `static/${args.imagePath}`
      });

      try {
        // Get the current file content to preserve the SHA
        const response = await octokit.repos.getContent({
          owner: "hugotion",
          repo: args.id,
          path: `static/${args.imagePath}`,
        });

        console.log("Get content response:", response.data);

        if (Array.isArray(response.data)) {
          throw new Error("Path is a directory, not a file");
        }

        if (!('sha' in response.data)) {
          console.error("Invalid response data:", response.data);
          throw new Error("File not found or invalid");
        }

        // Delete the file
        const deleteResponse = await octokit.repos.deleteFile({
          owner: "hugotion",
          repo: args.id,
          path: `static/${args.imagePath}`,
          message: "Deleted image",
          sha: response.data.sha
        });

        console.log("Delete response:", deleteResponse.data);
      } catch (error) {
        // If the file is not found (404), we can consider this a success
        // since our goal is to ensure the file doesn't exist
        if (error instanceof Error && 'status' in error && error.status === 404) {
          console.log("File already deleted or not found, proceeding with metadata update");
          return true;
        }
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Failed to delete image. Full error:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to delete image: ${error.message}`);
      }
      throw new Error("Failed to delete image. Please try again.");
    }
  }
});

export const createMarkdownFileInRepo = action({
  args: {
    id: v.id("documents"),
    filePath: v.string(), // e.g. content/en/about/_index.md or content/en/about/page.md
    content: v.string(),  // markdown content (frontmatter + body)
  },
  handler: async (_, args) => {
    try {
      // Decode the filePath to handle any double-encoded characters
      const decodedPath = decodeURIComponent(args.filePath);

      // Try to get the file to check if it already exists (to get sha if needed)
      let sha: string | undefined = undefined;
      try {
        const response = await octokit.repos.getContent({
          owner: "hugotion",
          repo: args.id,
          path: decodedPath,
        });
        if (!Array.isArray(response.data) && 'sha' in response.data) {
          sha = response.data.sha;
        }
      } catch (error) {
        // If not found, that's fine (we are creating)
        console.log("File not found, will create new:", decodedPath);
      }

      await octokit.repos.createOrUpdateFileContents({
        owner: "hugotion",
        repo: args.id,
        path: decodedPath,
        message: `Create file: ${decodedPath}`,
        content: Buffer.from(args.content).toString("base64"),
        ...(sha ? { sha } : {}),
      });
      return true;
    } catch (error) {
      console.error("Failed to create markdown file:", error);
      throw new Error("Failed to create markdown file. Please try again.");
    }
  },
});

export const deleteFile = action({
  args: {
    id: v.id("documents"),
    filePath: v.string(), // This is the top-level path to delete (file or directory)
  },
  handler: async (ctx, args) => { // ctx is available if we need to call other actions/mutations

    const deletePathRecursive = async (currentPath: string) => {
      console.log("[deletePathRecursive] Attempting to get content for path:", currentPath);
      let contentData;
      try {
        const response = await octokit.repos.getContent({
          owner: "hugotion",
          repo: args.id,
          path: currentPath,
        });
        contentData = response.data;
        console.log(`[deletePathRecursive] Got content for ${currentPath}. Type: ${Array.isArray(contentData) ? 'directory' : 'file'}, Data:`, JSON.stringify(contentData).substring(0, 200) + "...");
      } catch (error: any) {
        if (error.status === 404) {
          console.log(`[deletePathRecursive] Path ${currentPath} not found during getContent. Assuming already deleted or does not exist.`);
          return; // Nothing to delete
        }
        console.error(`[deletePathRecursive] Error fetching content for ${currentPath}:`, error.status, error.message, error.response?.data);
        throw error; // Rethrow other errors
      }

      if (Array.isArray(contentData)) {
        // It's a directory
        console.log(`[deletePathRecursive] Path ${currentPath} is a directory. Processing ${contentData.length} items within it...`);
        if (contentData.length === 0) {
          console.log(`[deletePathRecursive] Directory ${currentPath} is empty. No contents to delete from within.`);
          // GitHub usually removes empty directories automatically when the last file is deleted.
          // No explicit directory delete call is usually needed with this strategy.
          return;
        }
        // Important: Iterate over a copy of the array if items are being removed, though here we recurse.
        for (const item of contentData) {
          console.log(`[deletePathRecursive] Processing item in directory ${currentPath}: Path: ${item.path}, Type: ${item.type}, SHA: ${item.sha}`);
          // item.path is the full path from the repo root for items returned by getContent for a directory.
          await deletePathRecursive(item.path);
        }
        console.log(`[deletePathRecursive] Finished processing all items in directory ${currentPath}.`);

      } else if (typeof contentData === 'object' && contentData !== null && contentData.type === 'file') {
        // It's a single file
        console.log(`[deletePathRecursive] Path ${currentPath} is a file. Attempting to delete...`);
        if (!contentData.sha) {
          console.error(`[deletePathRecursive] Invalid file data for ${currentPath}, SHA is missing:`, contentData);
          throw new Error(`File ${currentPath} found but SHA is missing, cannot delete.`);
        }
        try {
          await octokit.repos.deleteFile({
            owner: "hugotion",
            repo: args.id,
            path: currentPath,
            message: `Delete file: ${currentPath}`,
            sha: contentData.sha,
          });
          console.log(`[deletePathRecursive] File ${currentPath} deleted successfully from GitHub.`);
        } catch (deleteError: any) {
           console.error(`[deletePathRecursive] Failed to delete file ${currentPath} from GitHub:`, deleteError.status, deleteError.message, deleteError.response?.data);
           if (deleteError.status === 404) {
             console.warn(`[deletePathRecursive] File ${currentPath} was not found during deletion attempt. Assuming already deleted.`);
           } else {
            throw deleteError; // Rethrow if it's not a 404 on delete
           }
        }
      } else {
        console.warn(`[deletePathRecursive] Path ${currentPath} was not identified as a processable file or directory. Content:`, contentData);
      }
    };

    try {
      console.log(`[deleteFile Action] Starting deletion process for top-level path: ${args.filePath}`);
      await deletePathRecursive(args.filePath);
      console.log(`[deleteFile Action] Successfully completed deletion process for path: ${args.filePath}`);
      return true;
    } catch (error: any) {
      console.error(`[deleteFile Action] Overall failure for path ${args.filePath}. Error:`, error.status, error.message, error.name, error.response?.data);

      let finalMessage = `Failed to delete path ${args.filePath}.`;
      if (error.name === 'HttpError' && error.response && error.response.data && error.response.data.message) {
        finalMessage = `GitHub API Error: ${error.response.data.message} (status: ${error.status || 'unknown'})`;
        if (error.response.data.documentation_url) {
           finalMessage += ` - See ${error.response.data.documentation_url}`;
        }
      } else if (error instanceof Error && error.message) {
        finalMessage = error.message; // Use the specific error message thrown by deletePathRecursive
      } else {
        finalMessage = `An unexpected error occurred while deleting ${args.filePath}. Status: ${error.status || 'unknown'}`;
      }
      console.error("[deleteFile Action] Throwing final error:", finalMessage);
      throw new Error(finalMessage);
    }
  },
});

type GitHubTreeItem = {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
  url?: string;
};

export const renamePathInRepo = action({
  args: {
    id: v.id("documents"),
    oldPath: v.string(),
    newPath: v.string(),
    itemType: v.union(v.literal("file"), v.literal("folder")),
  },
  handler: async (ctx, args) => {
    const owner = "hugotion";
    const repo = args.id;

    console.log(`[renamePathInRepo] Starting rename for repo '${repo}': '${args.oldPath}' to '${args.newPath}' (type: ${args.itemType})`);

    try {
      if (args.itemType === "file") {
        let oldFileContentBase64: string;
        let oldFileSha: string;

        try {
          const response = await octokit.repos.getContent({
            owner,
            repo,
            path: args.oldPath,
          });

          if (Array.isArray(response.data) || response.data.type !== 'file' || typeof response.data.content !== 'string' || !response.data.sha) {
            console.error(`[renamePathInRepo] Expected file at oldPath '${args.oldPath}', but got different type or missing content/SHA. Data:`, response.data);
            throw new Error(`'${args.oldPath}' is not a valid file or content is missing.`);
          }
          oldFileContentBase64 = response.data.content;
          oldFileSha = response.data.sha;
          console.log(`[renamePathInRepo] Fetched old file: '${args.oldPath}'`);
        } catch (error) {
          if (error instanceof Error && 'status' in error && error.status === 404) {
            console.error(`[renamePathInRepo] Old file '${args.oldPath}' not found.`);
            throw new Error(`File '${args.oldPath}' not found.`);
          }
          console.error(`[renamePathInRepo] Error fetching old file '${args.oldPath}':`, error);
          throw error;
        }

        try {
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: args.newPath,
            message: `Rename: Create new file ${args.newPath} (from ${args.oldPath})`,
            content: oldFileContentBase64,
          });
          console.log(`[renamePathInRepo] Created new file: '${args.newPath}'`);
        } catch (error) {
          console.error(`[renamePathInRepo] Error creating new file '${args.newPath}':`, error);
          throw new Error(`Failed to create '${args.newPath}'. Original file '${args.oldPath}' is untouched.`);
        }

        try {
          await octokit.repos.deleteFile({
            owner,
            repo,
            path: args.oldPath,
            message: `Rename: Delete old file ${args.oldPath} (moved to ${args.newPath})`,
            sha: oldFileSha,
          });
          console.log(`[renamePathInRepo] Deleted old file: '${args.oldPath}'`);
        } catch (error) {
          console.error(`[renamePathInRepo] Error deleting old file '${args.oldPath}':`, error);
          throw new Error(`Created '${args.newPath}', but failed to delete old '${args.oldPath}'. Please check repository.`);
        }

      } else if (args.itemType === "folder") {
        let oldFolderTreeItems: GitHubTreeItem[];
        try {
          const { data: treeData } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: "main",
            recursive: "true",
          });
          // Filter items that are blobs and within the oldPath. oldPath itself is not included if it's just a prefix.
          oldFolderTreeItems = treeData.tree.filter(
            (item: GitHubTreeItem) => item.path && item.path.startsWith(args.oldPath + '/') && item.type === 'blob'
          );
          
          // Handle case where the folder being renamed is empty or contains only an _index.md or similar at its root.
          // Check if oldPath itself is a file (e.g. _index.md representing the folder section)
          const oldPathItself = treeData.tree.find(
            (item: GitHubTreeItem) => item.path === args.oldPath && item.type === 'blob'
          );

          if(oldPathItself) {
            oldFolderTreeItems.push(oldPathItself); // Add it to the list of items to move
          }

          if (oldFolderTreeItems.length === 0) {
            console.log(`[renamePathInRepo] Old folder '${args.oldPath}' is empty or contains no direct files (blobs). If it has subfolders with files, they should be caught by recursive delete.`);
            // If the folder is truly empty, deleting it might be all that's needed.
            // The creation of the new folder structure happens implicitly when files are moved into it.
          }
          console.log(`[renamePathInRepo] Found ${oldFolderTreeItems.length} files to move for folder '${args.oldPath}'.`);
        } catch (error) {
          console.error(`[renamePathInRepo] Error fetching tree for old folder '${args.oldPath}':`, error);
          throw error;
        }

        for (const item of oldFolderTreeItems) {
          if (!item.path || !item.sha) continue;

          const oldFilePath = item.path;
          // Construct new path by replacing the old folder path prefix with the new one.
          const newFilePath = oldFilePath.replace(args.oldPath, args.newPath);

          try {
            const { data: blobData } = await octokit.git.getBlob({
              owner,
              repo,
              file_sha: item.sha,
            });

            if (typeof blobData.content !== 'string') {
                console.error(`[renamePathInRepo] Blob content for '${oldFilePath}' is not base64 string. Skipping.`);
                continue;
            }

            await octokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: newFilePath,
              message: `Rename: Move ${oldFilePath} to ${newFilePath}`,
              content: blobData.content, // content is base64
            });
            console.log(`[renamePathInRepo] Moved '${oldFilePath}' to '${newFilePath}'`);
          } catch (error) {
            console.error(`[renamePathInRepo] Error moving file '${oldFilePath}' to '${newFilePath}':`, error);
            throw new Error(`Failed to move '${oldFilePath}'. Operation halted. Some files may have been copied.`);
          }
        }
        // After all files are moved, delete the old folder structure.
        if (oldFolderTreeItems.length > 0) {
          console.log(`[renamePathInRepo] Deleting old folder structure: '${args.oldPath}'`);
          try {
            await ctx.runAction(api.github.deleteFile, {
                id: args.id,
                filePath: args.oldPath, // deleteFile action handles recursive deletion
            });
            console.log(`[renamePathInRepo] Deleted old folder '${args.oldPath}'.`);
          } catch (error) {
              console.error(`[renamePathInRepo] Files moved, but failed to delete old folder '${args.oldPath}':`, error);
              throw new Error(`Files moved to '${args.newPath}', but failed to delete old folder '${args.oldPath}'.`);
          }
        } else {
            console.log(`[renamePathInRepo] Old folder '${args.oldPath}' was empty or did not require content deletion after moving files.`);
        }
      }
      console.log(`[renamePathInRepo] Rename operation completed for '${args.oldPath}' to '${args.newPath}'.`);
      return true;

    } catch (error) {
      console.error(`[renamePathInRepo] Overall failure for rename '${args.oldPath}' to '${args.newPath}'. Error:`, error);
      throw new Error(error instanceof Error ? error.message : "Failed to rename item in repository.");
    }
  },
});

export const fetchAssetsTree = action({
  args: {
    id: v.id("documents")
  },
  handler: async (_, args) => {
    try {
      // Step 1: Get the entire tree of the main branch
      const { data: mainTree } = await octokit.git.getTree({
        owner: "hugotion",
        repo: args.id,
        tree_sha: "main",
        recursive: "false", // Fetch only the top-level directories
      });

      // Step 2: Find both static and assets folders
      const staticFolder = mainTree.tree.find((item: any) =>
        item.path === "static" && item.type === "tree"
      );
      const assetsFolder = mainTree.tree.find((item: any) =>
        item.path === "assets" && item.type === "tree"
      );

      // Use a Map to ensure unique entries by path
      const assetsMap = new Map();

      // Step 3: Fetch the tree for the "static" directory if it exists
      if (staticFolder && staticFolder.sha) {
        const { data: staticTree } = await octokit.git.getTree({
          owner: "hugotion",
          repo: args.id,
          tree_sha: staticFolder.sha,
          recursive: "true",
        });
        staticTree.tree.forEach((item: any) => {
          assetsMap.set(item.path, {
            ...item,
            path: `static/${item.path}`
          });
        });
      }

      // Step 4: Fetch the tree for the "assets" directory if it exists
      if (assetsFolder && assetsFolder.sha) {
        const { data: assetsTree } = await octokit.git.getTree({
          owner: "hugotion",
          repo: args.id,
          tree_sha: assetsFolder.sha,
          recursive: "true",
        });
        assetsTree.tree.forEach((item: any) => {
          assetsMap.set(item.path, {
            ...item,
            path: `assets/${item.path}`
          });
        });
      }

      // Convert Map back to array
      return Array.from(assetsMap.values());
    } catch (error) {
      console.error("Error fetching GitHub content folder tree:", error);
      throw new Error("Failed to fetch GitHub content folder tree");
    }
  }
});

export const deleteAsset = action({
  args: {
    id: v.id("documents"),
    filePath: v.string(),
  },
  handler: async (_, args) => {
    try {
      // First, get the current file to get its SHA
      const response = await octokit.repos.getContent({
        owner: "hugotion",
        repo: args.id,
        path: args.filePath,
      });

      if (Array.isArray(response.data)) {
        throw new Error("Path is a directory, not a file");
      }

      const sha = response.data.sha;

      // Delete the file
      await octokit.repos.deleteFile({
        owner: "hugotion",
        repo: args.id,
        path: args.filePath,
        message: `Delete asset: ${args.filePath}`,
        sha: sha,
      });

      return true;
    } catch (error) {
      console.error("Failed to delete asset:", error);
      throw new Error("Failed to delete asset. Please try again.");
    }
  }
});