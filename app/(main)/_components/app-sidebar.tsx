"use client";

import React, { useEffect, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearch } from "@/hooks/use-search";
import { useSettings } from "@/hooks/use-settings";
import { useParams, useRouter } from "next/navigation";
import { useAppSidebar, GitHubList } from "@/hooks/use-app-sidebar";
import { toast } from "sonner";
import {
  File as FileIcon,
  Folder as FolderIcon,
  Search,
  Settings,
  Trash,
  MoreHorizontal,
  Edit,
} from "lucide-react";
import Image from "next/image";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { UserItem } from "./user-item";
import { Item } from "./item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrashBox } from "./trash-box";
import { WebsiteSwitcher } from "./website-switcher";
import { TreeView, TreeDataItem } from "@/components/tree-view";
import { Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/spinner";
import { Skeleton } from "@/components/ui/skeleton";

interface TreeNode {
  name?: string;
  path?: string;
  type?: string;
  children?: TreeNode[];
  sha?: string;
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { treeData: rawTreeData, setItems, isLoading, setIsLoading, error, setError } = useAppSidebar();

  const settings = useSettings();
  const search = useSearch();
  const router = useRouter();
  const params = useParams();

  const fetchContentTree = useAction(api.github.fetchGitHubFileTree);
  const createMarkdownFile = useAction(api.github.createMarkdownFileInRepo);
  const document = useQuery(api.documents.getById,
    params.documentId ? { documentId: params.documentId as Id<"documents"> } : "skip"
  );
  const deleteFile = useAction(api.github.deleteFile);
  const renameGithubPath = useAction(api.github.renamePathInRepo);

  const refreshTree = useCallback(async () => {
    if (!params.documentId) return;
    setIsLoading(true);
    try {
      const promise = fetchContentTree({
        id: params.documentId as Id<"documents">,
      });

      toast.promise(promise, {
        loading: "Refreshing file tree...",
        success: "File tree refreshed successfully!",
        error: "Failed to refresh file tree. Please try again."
      });

      const result = await promise;
      const processedResult = result.map(item => ({
        ...item,
        path: typeof item.path === 'string' ? item.path : '',
        type: typeof item.type === 'string' ? item.type : 'blob',
        sha: typeof item.sha === 'string' ? item.sha : String(Math.random()),
        name: typeof item.path === 'string' ? item.path.split('/').pop() || item.path : 'Unnamed',
      }));
      setItems(processedResult as GitHubList[]);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch GitHub file tree:", err);
      setError("Failed to load file structure. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [params.documentId, fetchContentTree, setIsLoading, setItems, setError]);

  useEffect(() => {
    async function loadFileTree() {
      if (!params.documentId || !document || document.workflowRunning) return;
      await refreshTree();
    }
    loadFileTree();
  }, [params.documentId, document?.workflowRunning, refreshTree]);

  const handleCreateItem = async (parentId: string | undefined, type: "file" | "folder") => {
    if (!params.documentId) return;
    const itemName = window.prompt(`Enter new ${type} name:`);
    if (!itemName) return;

    let parentPath = "";
    if (parentId) {
      const findParent = (nodes: TreeNode[], id: string): TreeNode | undefined => {
        for (const node of nodes) {
          if (node.sha === id || node.path === id) return node;
          if (node.children) {
            const found = findParent(node.children, id);
            if (found) return found;
          }
        }
        return undefined;
      };
      const parentNode = findParent(rawTreeData as TreeNode[], parentId);
      if (parentNode && parentNode.path) {
        parentPath = parentNode.path;
      } else if (parentId && type === "folder") {
        console.warn("Could not determine parent path from parentId:", parentId);
      }
    }

    setIsLoading(true);
    const today = new Date().toISOString().split("T")[0];

    let filePath = "";
    let content = "";

    if (type === "folder") {
      filePath = parentPath ? `${parentPath}/${itemName}/_index.md` : `${itemName}/_index.md`;
      content = `---\ntitle: \"${itemName}\"\ndate: ${today}\n---\n`;
    } else {
      filePath = parentPath ? `${parentPath}/${itemName}.md` : `${itemName}.md`;
      content = `---\ntitle: \"${itemName}\"\ndate: ${today}\n---\n`;
    }

    try {
      const promise = createMarkdownFile({
        id: params.documentId as Id<"documents">,
        filePath: `content/${filePath}`,
        content,
      });

      toast.promise(promise, {
        loading: `Creating ${type}...`,
        success: `${type === "folder" ? "Folder" : "Page"} "${itemName}" created successfully!`,
        error: `Failed to create ${type}. Please try again.`
      });

      await promise;
      await refreshTree();
    } catch (err) {
      console.error(`Failed to create ${type}:`, err);
      setError(`Failed to create ${type}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (itemPath: string | undefined) => {
    if (!itemPath || !params.documentId) return;

    const confirmDelete = window.confirm("Are you sure you want to delete this item permanently? This action cannot be undone.");
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      const promise = deleteFile({
        id: params.documentId as Id<"documents">,
        filePath: `content/${itemPath}`,
      });

      toast.promise(promise, {
        loading: "Deleting...",
        success: "Successfully deleted!",
        error: "Failed to delete item. Please try again."
      });

      await promise;
      await refreshTree();
    } catch (err) {
      console.error("Failed to delete item:", err);
      setError("Failed to delete item.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameItem = async (itemPath: string | undefined, currentName: string | undefined, itemType: string | undefined) => {
    if (!itemPath || !currentName || !params.documentId || !itemType) return;

    const newNameFromPrompt = window.prompt(`Enter new name for "${currentName}":`, currentName);
    if (!newNameFromPrompt || newNameFromPrompt === currentName) return;
    
    // Basic validation for new name (e.g., cannot contain slashes)
    if (newNameFromPrompt.includes('/') || newNameFromPrompt.includes('\\\\')) {
        toast.error("New name cannot contain slashes.");
        return;
    }

    setIsLoading(true);
    try {
      const pathSegments = itemPath.split('/');
      pathSegments.pop(); // Remove old name segment
      const parentDirectoryPath = pathSegments.join('/');

      const oldFullPath = `content/${itemPath}`;
      const newFullPath = `content/${parentDirectoryPath ? parentDirectoryPath + '/' : ''}${newNameFromPrompt}`;

      const promise = renameGithubPath({
        id: params.documentId as Id<"documents">,
        oldPath: oldFullPath,
        newPath: newFullPath,
        itemType: itemType === "tree" ? "folder" : "file",
      });

      toast.promise(promise, {
        loading: `Renaming "${currentName}" to "${newNameFromPrompt}"...`,
        success: () => {
          // Refresh the specific part of the URL if the renamed item was the one being viewed
          if (params.path && `content/${params.path}`.startsWith(oldFullPath)) {
            if (oldFullPath === `content/${(params.path as string[])?.join('/')}`) {
                const newNavigationPath = newFullPath.substring('content/'.length);
                router.push(`/documents/${params.documentId}/${newNavigationPath}`);
            }
          }
          return `Successfully renamed to "${newNameFromPrompt}"!`;
        },
        error: `Failed to rename. Please try again.`
      });

      await promise;
      await refreshTree();
    } catch (err) {
      console.error("Failed to rename item:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const transformDataToTreeDataItems = useCallback((nodes: TreeNode[] | GitHubList[] | undefined): TreeDataItem[] => {
    if (!nodes) return [];

    const getItemActions = (itemPath: string | undefined, itemType: string | undefined, itemId: string, itemName: string | undefined): React.ReactNode => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <div
              role="button"
              aria-label="Actions"
              className="p-1 hover:bg-accent dark:hover:bg-accent rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()} side="right" align="start">
            <DropdownMenuItem
              onClick={() => handleRenameItem(itemPath, itemName, itemType)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            {itemType === "tree" && (
              <>
                <DropdownMenuItem onClick={() => handleCreateItem(itemId, "folder")}>
                  <FolderIcon className="h-4 w-4 mr-2" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateItem(itemId, "file")}>
                  <FileIcon className="h-4 w-4 mr-2" />
                  New File
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDeleteItem(itemPath)}
              className="text-destructive focus:text-destructive"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete Permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    };

    return nodes.map((node) => {
      const typedNode = node as TreeNode;

      const name = typedNode.name || (typedNode.path ? typedNode.path.split('/').pop() : 'Unnamed');
      const id = typedNode.sha || typedNode.path || String(Math.random());
      const isFolder = typedNode.type === "tree";

      return {
        id: id,
        name: name || "Unnamed Item",
        icon: isFolder ? FolderIcon : FileIcon,
        children: isFolder && typedNode.children && typedNode.children.length > 0
                    ? transformDataToTreeDataItems(typedNode.children)
                    : undefined,
        actions: getItemActions(typedNode.path, typedNode.type, id, name),
        onClick: () => {
          if (!isFolder && typedNode.path && params.documentId) {
            let navigationPath = typedNode.path;
            if (navigationPath.startsWith('content/')) {
                navigationPath = navigationPath.substring('content/'.length);
            }
            router.push(`/documents/${params.documentId}/${navigationPath}`);
          }
        },
      };
    });
  }, [router, params.documentId, handleCreateItem, handleDeleteItem, handleRenameItem, renameGithubPath, refreshTree]);

  const displayTreeData = React.useMemo(() => transformDataToTreeDataItems(rawTreeData), [rawTreeData, transformDataToTreeDataItems]);

  return (
    <Sidebar
      className="top-[--header-height] !h-[calc(100svh-var(--header-height))]"
      {...props}
    >
      <SidebarHeader>
        <WebsiteSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {params.documentId && (
          <>
            <Item label="Search" icon={Search} isSearch onClick={search.onOpen} />
            <Item label="Settings" icon={Settings} onClick={settings.onOpen} />
            <Popover>
              <PopoverTrigger className="w-full">
                <Item label="Trash" icon={Trash} />
              </PopoverTrigger>
              <PopoverContent side="top" className="p-0 w-72">
                <TrashBox />
              </PopoverContent>
            </Popover>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Content</SidebarGroupLabel>
              <SidebarGroupContent>
                {isLoading && document?.workflowRunning ? (
                  <div className="flex flex-col items-center justify-center p-4">
                    <Spinner />
                    <div className="mt-2 text-sm">Creating site...</div>
                  </div>
                ) : isLoading ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-[90%]" />
                    <Skeleton className="h-8 w-[80%]" />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center p-4">
                    <Image
                      src="/documents.png"
                      height="200"
                      width="200"
                      alt="Empty"
                      className="dark:hidden"
                    />
                    <Image
                      src="/documents-dark.png"
                      height="200"
                      width="200"
                      alt="Empty"
                      className="hidden dark:block"
                    />
                    <p className="mt-2 text-sm text-center text-muted-foreground">{error}</p>
                  </div>
                ) : (
                  <TreeView
                    data={displayTreeData}
                    initialSelectedItemId={params.documentId && params.path ? `/documents/${params.documentId}/${(params.path as string[]).join('/')}` : undefined}
                    onSelectChange={() => {
                      // onClick is handled by TreeDataItem, no explicit action needed here for now
                    }}
                    expandAll={false}
                    defaultNodeIcon={FolderIcon}
                    defaultLeafIcon={FileIcon}
                    className="p-2"
                  />
                )}
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <UserItem />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}