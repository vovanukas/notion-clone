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
   },
  handler: async (ctx, args) => {
    console.log("Creating repo...");
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error ("Unauthenticated");
    }

    ctx.runMutation(api.documents.update, {
      id: args.repoName,
      workflowRunning: true,
    })

    try {
      // Step 1: Create a new repository in the organization
      const response = await octokit.repos.createInOrg({
        org: "hugotion", // Replace with your org name
        name: args.repoName,
        private: false,
        description: "Hugo site repository",
      });

      const repoUrl = response.data.html_url;
      console.log("Repository created:", repoUrl);

      await ctx.runAction(api.github.encryptAndPublishSecret, ({
        id: args.repoName,
        secret: identity.subject
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
      uses: actions/checkout@v3

    - name: Configure Git user
      run: |
        git config --global user.name "GitHub Actions"
        git config --global user.email "actions@github.com"

    - name: Add Ananke theme as subtree
      run: |
        git subtree add --prefix=themes/ananke https://github.com/theNewDynamic/gohugo-theme-ananke.git master --squash

    - name: Copy example site content
      run: |
        cp -r themes/ananke/exampleSite/* ./
        rm go.mod go.sum

    - name: Modify configuration
      run: |
        sed -i 's|^theme *= *.*|theme = "ananke"|' config.toml
      
    - name: Delete Workflow File
      run: |
        rm .github/workflows/hugo-setup.yml

    - name: Commit and push changes
      env:
        GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      run: |
        git add .
        git commit -m "Initial setup with Ananke theme"
        git push https://x-access-token:\${{ secrets.GITHUB_TOKEN }}@github.com/hugotion/\${{ github.event.repository.name }}.git main

    - name: Workflow Webhook Action
      uses: distributhor/workflow-webhook@v3
      with:
        webhook_url: 'https://cool-pelican-27.convex.site/callbackPageDeployed'
        webhook_auth_type: "bearer"
        webhook_auth: \${{ secrets.CALLBACK_BEARER }}
        data: '{ "workflowRunning": false }'
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
      workflowRunning: true,
    })

    await ctx.runAction(api.github.encryptAndPublishSecret, ({
      id: args.id,
      secret: identity.subject
    }))

    try {
      await octokit.actions.createWorkflowDispatch({
        owner: "hugotion",
        repo: args.id,
        workflow_id: "hugo-build-deploy.yml",
        ref: "main",
      })
    } catch (error) {
      if (!(error instanceof Error && error instanceof Object && 'status' in error)) {
        console.error(error)
        return
      }

      if (error.status === 404) {
        const deployWorkflowContent = `
name: GitHub Pages

on:
  push:
    branches:
      - main  # Set a branch name to trigger deployment
  pull_request:

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

      - name: Workflow Webhook Action
        uses: distributhor/workflow-webhook@v3
        with:
          webhook_url: 'https://cool-pelican-27.convex.site/callbackPageDeployed'
          webhook_auth_type: "bearer"
          webhook_auth: \${{ secrets.CALLBACK_BEARER }}
          data: '{ "workflowRunning": false }'`;
    
        await octokit.repos.createOrUpdateFileContents({
          owner: "hugotion", // Replace with your org name
          repo: args.id, // Use the dynamic repo name
          path: ".github/workflows/hugo-build-deploy.yml",
          message: "Add Hugo setup workflow",
          content: Buffer.from(deployWorkflowContent).toString("base64"), // Encode to base64
        });
      }
    }
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
      secret_name: 'CALLBACK_BEARER',
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

export const parseAndSaveSettingsObject = action({
  args: {
    id: v.id("documents"),
    newSettings: v.string(),
  },
  handler: async (_, args) => {
    const contentResponse = await octokit.repos.getContent({
      owner: "hugotion",
      repo: args.id,
      path: "config.toml",
    });

    if (!Array.isArray(contentResponse.data) && contentResponse.data.type === 'file') {
      const { sha } = contentResponse.data;

      const updatedConfig = args.newSettings;

      await octokit.repos.createOrUpdateFileContents({
        owner: "hugotion",
        repo: args.id,
        path: "config.toml",
        message: "Changed config settings",
        content: Buffer.from(updatedConfig).toString("base64"),
        sha,
      });
    } else {
      throw new Error("The path is not a file or does not exist.");
    }
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
    for (const file of args.filesToUpdate) {
      const { content, path, ...metadata } = file;
      try {
        // Get the current file content to preserve the SHA
        const response = await octokit.repos.getContent({
          owner: "hugotion",
          repo: args.id,
          path: `content/${path}`,
        });

        if (Array.isArray(response.data)) {
          throw new Error("Path is a directory, not a file");
        }

        if (!('sha' in response.data)) {
          throw new Error("File not found or invalid");
        }

        // Create the frontmatter string
        const frontmatter = matter.stringify(content, metadata);

        // Update the file with the new content
        await octokit.repos.createOrUpdateFileContents({
          owner: "hugotion",
          repo: args.id,
          path: `content/${path}`,
          message: `Updated content of: ${path}`,
          content: Buffer.from(frontmatter).toString("base64"),
          sha: response.data.sha
        });
      } catch (error) {
        console.error(`Failed to update file ${path}:`, error);
        throw error;
      }
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