"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearch } from "@/hooks/use-search";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useAppSidebar, GitHubList } from "@/hooks/use-app-sidebar";
import { useSettings, useTemplateSchema, getSectionsFromSchema } from "@/hooks/use-settings";
import { generateFrontmatterFromSchema } from "@/hooks/use-document";
import { toast } from "sonner";
import {
  File as FileIcon,
  Folder as FolderIcon,
  Search,
  Settings,
  Trash,
  MoreHorizontal,
  Edit,
  Image as ImageIcon,
  Plus,
  ChevronRight,
  ChevronDown,
  Home,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { UserItem } from "./user-item";
import { Item } from "./item";
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

/**
 * Extract clean error message from Convex errors
 */
function cleanErrorMessage(error: unknown, defaultMessage: string = "An error occurred"): string {
  if (error instanceof Error) {
    // ConvexError stores the message in .data, regular errors in .message
    const convexData = (error as any).data;
    if (typeof convexData === 'string') {
      return convexData;
    }
    // Fallback to message, stripping any technical prefixes
    let msg = error.message;
    msg = msg.replace(/^Uncaught Error:\s*/, "");
    return msg.trim() || defaultMessage;
  }
  return defaultMessage;
}

interface TreeNode {
  name?: string;
  path?: string;
  type?: string;
  children?: TreeNode[];
  sha?: string;
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { treeData: rawTreeData, setItems, isLoading, setIsLoading, error, setError, resetSidebarState } = useAppSidebar();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const search = useSearch();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  const document = useQuery(api.documents.getById,
    params.documentId ? { documentId: params.documentId as Id<"documents"> } : "skip"
  );

  // Settings management
  const { currentSection, setCurrentSection } = useSettings();
  const template = useTemplateSchema(document?.theme);
  const availableSections = getSectionsFromSchema(template?.settingsJsonSchema, template?.settingsUiSchema);

  // Clear currentSection when navigating away from settings page
  useEffect(() => {
    const isOnSettingsPage = pathname.includes('/settings');
    
    // If we're not on a settings page and currentSection is set, clear it
    if (!isOnSettingsPage && currentSection) {
      setCurrentSection(null);
    }
  }, [pathname, currentSection, setCurrentSection]);

  const fetchContentTree = useAction(api.github.fetchGitHubFileTree);
  const createMarkdownFile = useAction(api.github.createMarkdownFileInRepo);
  const deleteFile = useAction(api.github.deleteFile);
  const renameGithubPath = useAction(api.github.renamePathInRepo);
  const fetchFileContent = useAction(api.github.fetchAndReturnGithubFileContent);

  // Silent refresh - updates tree data without showing loading skeleton
  // Used after creating/deleting items to preserve UX
  const silentRefreshTree = useCallback(async () => {
    if (!params.documentId) return;

    try {
      const result = await fetchContentTree({
        id: params.documentId as Id<"documents">,
      });

      if (!result || result.length === 0) {
        return;
      }

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
      console.error("Failed to refresh GitHub file tree:", err);
      // Don't show error for silent refresh - the tree still has old data
    }
  }, [params.documentId, fetchContentTree, setItems, setError]);

  // Simple hash change handler for settings navigation
  useEffect(() => {
    const updateSettingsState = () => {
      const hash = window.location.hash.slice(1);
      const isOnSettingsPage = window.location.pathname.includes('/settings');

      if (isOnSettingsPage) {
        setIsSettingsOpen(true);
        setCurrentSection(hash || null);
      } else {
        setIsSettingsOpen(false);
        setCurrentSection(null);
      }
    };

    window.addEventListener('hashchange', updateSettingsState);
    window.addEventListener('popstate', updateSettingsState);
    updateSettingsState(); // Initial state

    return () => {
      window.removeEventListener('hashchange', updateSettingsState);
      window.removeEventListener('popstate', updateSettingsState);
    };
  }, [setCurrentSection]);

  useEffect(() => {
    async function loadFileTree() {
      if (!params.documentId) {
        resetSidebarState();
        return;
      }

      if (document?.buildStatus === "BUILDING" || !document) {
        resetSidebarState();
        return;
      }

      setIsLoading(true);
      try {
        const promise = fetchContentTree({
          id: params.documentId as Id<"documents">,
        });

        const result = await promise;
        if (!result || result.length === 0) {
          resetSidebarState();
          return;
        }

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
        resetSidebarState();
      } finally {
        setIsLoading(false);
      }
    }
    loadFileTree();
  }, [params.documentId, document, fetchContentTree, setIsLoading, setItems, setError, resetSidebarState]);

  // Create a new page - either at root level or as a subpage
  const handleCreatePage = useCallback(async (parentPath?: string) => {
    if (!params.documentId) return;
    const pageName = window.prompt("Enter new page name:");
    if (!pageName) return;

    // If no parent, create at root level as a simple .md file
    // If parent exists, create inside the parent folder
    const filePath = parentPath
      ? `${parentPath}/${pageName}.md`
      : `${pageName}.md`;

    // Generate frontmatter from the template's pageSettingsJsonSchema
    const content = generateFrontmatterFromSchema(template?.pageSettingsJsonSchema, pageName);

    try {
      const promise = createMarkdownFile({
        id: params.documentId as Id<"documents">,
        filePath: `content/${filePath}`,
        content,
        failIfExists: true,
      });

      toast.promise(promise, {
        loading: "Creating page...",
        success: `Page "${pageName}" created successfully!`,
        error: (err) => cleanErrorMessage(err, "Failed to create page")
      });

      await promise;
      await silentRefreshTree();
    } catch (err) {
      console.error("Failed to create page:", err);
      // Error is handled by toast
    }
  }, [params.documentId, createMarkdownFile, silentRefreshTree, template]);

  // Add a subpage to an existing page
  // If the page is a file (.md), we need to convert it to a folder first
  const handleAddSubpage = useCallback(async (itemPath: string | undefined, itemType: string | undefined, itemName: string | undefined) => {
    if (!params.documentId || !itemPath) return;

    const subpageName = window.prompt("Enter subpage name:");
    if (!subpageName) return;

    try {
      if (itemType === "tree") {
        // It's already a folder, just add a new page inside
        const filePath = `${itemPath}/${subpageName}.md`;
        const content = generateFrontmatterFromSchema(template?.pageSettingsJsonSchema, subpageName);

        const promise = createMarkdownFile({
          id: params.documentId as Id<"documents">,
          filePath: `content/${filePath}`,
          content,
          failIfExists: true,
        });

        toast.promise(promise, {
          loading: "Creating subpage...",
          success: `Subpage "${subpageName}" created successfully!`,
          error: (err) => cleanErrorMessage(err, "Failed to create subpage")
        });

        await promise;
      } else {
        // It's a file - we need to convert it to a folder structure
        // 1. Get the current file content
        // 2. Create a new folder with _index.md containing the original content
        // 3. Create the new subpage
        // 4. Delete the original file

        toast.loading("Converting to page with subpage...");

        // Get the original content
        const originalContent = await fetchFileContent({
          id: params.documentId as Id<"documents">,
          path: `content/${itemPath}`,
        });

        // Determine the new folder path (remove .md extension)
        const folderPath = itemPath.replace(/\.md$/, '');

        // Create the _index.md with original content
        // If _index.md already exists, this should fail to avoid overwriting (though unexpected)
        await createMarkdownFile({
          id: params.documentId as Id<"documents">,
          filePath: `content/${folderPath}/_index.md`,
          content: originalContent,
          failIfExists: true,
        });

        // Create the new subpage with proper frontmatter
        const subpageContent = generateFrontmatterFromSchema(template?.pageSettingsJsonSchema, subpageName);
        await createMarkdownFile({
          id: params.documentId as Id<"documents">,
          filePath: `content/${folderPath}/${subpageName}.md`,
          content: subpageContent,
          failIfExists: true,
        });

        // Delete the original file
        await deleteFile({
          id: params.documentId as Id<"documents">,
          filePath: `content/${itemPath}`,
        });

        toast.dismiss();
        toast.success(`Converted "${itemName}" to a page with subpage "${subpageName}"!`);
      }

      await silentRefreshTree();
    } catch (err) {
      console.error("Failed to add subpage:", err);
      toast.dismiss();
      // Show specific error message if available
      toast.error(cleanErrorMessage(err, "Failed to add subpage. Please try again."));
      // setError("Failed to add subpage."); // Rely on toast for feedback
    }
  }, [params.documentId, createMarkdownFile, deleteFile, fetchFileContent, silentRefreshTree, template]);

  const handleDeleteItem = useCallback(async (itemPath: string | undefined) => {
    if (!itemPath || !params.documentId) return;

    const confirmDelete = window.confirm("Are you sure you want to delete this item permanently? This action cannot be undone.");
    if (!confirmDelete) return;

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
      await silentRefreshTree();
    } catch (err) {
      console.error("Failed to delete item:", err);
      setError("Failed to delete item.");
    }
  }, [params.documentId, deleteFile, silentRefreshTree, setError]);

  const handleRenameItem = useCallback(async (itemPath: string | undefined, currentName: string | undefined, itemType: string | undefined) => {
    if (!itemPath || !currentName || !params.documentId || !itemType) return;

    const newNameFromPrompt = window.prompt(`Enter new name for "${currentName}":`, currentName);
    if (!newNameFromPrompt || newNameFromPrompt === currentName) return;
    
    // Basic validation for new name (e.g., cannot contain slashes)
    if (newNameFromPrompt.includes('/') || newNameFromPrompt.includes('\\\\')) {
        toast.error("New name cannot contain slashes.");
        return;
    }

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
        error: (err) => cleanErrorMessage(err, "Failed to rename. Please try again.")
      });

      await promise;
      await silentRefreshTree();
    } catch (err) {
      console.error("Failed to rename item:", err);
    }
  }, [params.documentId, renameGithubPath, silentRefreshTree, router, params.path]);

  // Simplified scroll function
  const scrollToSection = useCallback((sectionKey: string) => {
    setTimeout(() => {
      const element = window.document.getElementById(`root_${sectionKey}__title`);
      if (element) {
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: elementPosition - 100, behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // Handle settings navigation
  const handleSettingsNavigation = useCallback((sectionKey: string | null) => {
    if (!params.documentId) return;

    const settingsUrl = `/documents/${params.documentId}/settings`;
    const isOnSettingsPage = window.location.pathname.includes('/settings');

    // Update the currentSection state immediately
    setCurrentSection(sectionKey);

    if (sectionKey) {
      const urlWithHash = `${settingsUrl}#${sectionKey}`;
      if (isOnSettingsPage) {
        window.location.hash = sectionKey;
        scrollToSection(sectionKey);
      } else {
        router.push(urlWithHash);
      }
    } else {
      router.push(settingsUrl);
    }
  }, [params.documentId, router, scrollToSection, setCurrentSection]);

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
            <DropdownMenuItem onClick={() => handleAddSubpage(itemPath, itemType, itemName)}>
              <Plus className="h-4 w-4 mr-2" />
              Add subpage
            </DropdownMenuItem>
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

      let children = typedNode.children;
      const isFolder = typedNode.type === "tree";

      // Check if folder contains _index.md or index.md (Hugo branch/leaf bundles)
      const indexFile = children?.find(c =>
        c.name === '_index.md' || c.path?.endsWith('/_index.md') ||
        c.name === 'index.md' || c.path?.endsWith('/index.md')
      );

      // If it's a folder with an index file, treat it as a Page that can have children.
      // We remove the index file from the visible children list.
      if (isFolder && indexFile) {
          children = children?.filter(c => c !== indexFile);
      }

      let name = typedNode.name || (typedNode.path ? typedNode.path.split('/').pop() : 'Unnamed');
      
      // Strip .md extension from the name for display
      if (name && name.endsWith('.md')) {
        name = name.replace(/\.md$/, '');
      }

      const id = typedNode.sha || typedNode.path || String(Math.random());

      // In "Notion-like" view, everything looks like a File (Page).
      // Folders are just Pages that happen to have children.
      let icon = FileIcon;

      // Special case for root _index.md -> Home Page
      if (name === '_index') {
        name = 'Home Page';
        icon = Home;
      }

      // If children array is empty after filtering, we treat it as having no children (leaf)
      const hasChildren = children && children.length > 0;

      return {
        id: id,
        name: name || "Unnamed Item",
        path: typedNode.path,  // Pass path for stable expanded state tracking
        icon: icon,
        children: hasChildren
                    ? transformDataToTreeDataItems(children)
                    : undefined,
        actions: getItemActions(typedNode.path, typedNode.type, id, name),
        onClick: () => {
          // Navigate on click for everything (Folders/Pages and Files)
          if (typedNode.path && params.documentId) {
            let navigationPath = typedNode.path;

            // If it's a folder treated as a Page (has _index.md or index.md), navigate to the index file
            // This ensures the backend fetches the file content, not the directory listing
            if (isFolder && indexFile && indexFile.path) {
                navigationPath = indexFile.path;
            }

            if (navigationPath.startsWith('content/')) {
                navigationPath = navigationPath.substring('content/'.length);
            }
            router.push(`/documents/${params.documentId}/${navigationPath}`);
          }
        },
      };
    });
  }, [router, params.documentId, handleAddSubpage, handleDeleteItem, handleRenameItem]);

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
            {/* Settings with split button design */}
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <div className="flex">
                {/* Main Settings Button - Navigate to All Settings */}
                <div
                  className={`group min-h-[27px] text-sm py-1 pl-3 pr-1 flex-1 hover:bg-primary/5 flex items-center font-medium cursor-pointer ${
                    pathname.includes('/settings') && !currentSection
                      ? "bg-primary/5 text-primary"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => handleSettingsNavigation(null)}
                >
                  <Settings className="shrink-0 h-[18px] w-[18px] mr-2 text-muted-foreground" />
                  <span>Settings</span>
                </div>
                
                {/* Separate Arrow Button - Toggle Submenu */}
                <CollapsibleTrigger asChild>
                  <div className="min-h-[27px] px-2 hover:bg-primary/5 flex items-center cursor-pointer text-muted-foreground">
                    {!template && document?.theme ? (
                      <Spinner size="sm" />
                    ) : isSettingsOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    )}
                  </div>
                </CollapsibleTrigger>
                </div>
              <CollapsibleContent>
                <div className="pl-8 py-1 space-y-1">
                  {availableSections.length > 0 ? (
                    <>
                      {/* Individual Sections Only */}
                      {availableSections.map((section) => (
                        <div
                          key={section.key}
                          className={`min-h-[27px] text-sm py-1 pr-3 w-full hover:bg-primary/5 flex items-center font-medium cursor-pointer ${
                            currentSection === section.key && pathname.includes('/settings')
                              ? "bg-primary/5 text-primary"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => handleSettingsNavigation(section.key)}
                        >
                          <span>{section.title}</span>
                  </div>
                      ))}
                    </>
                  ) : (
                    <div className="min-h-[27px] text-sm py-1 pr-3 w-full flex items-center text-muted-foreground/50 font-medium">
                      <span>No settings available</span>
                  </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
            <Item
              label="Assets"
              icon={ImageIcon}
              onClick={() => {
                if (params.documentId) {
                  router.push(`/documents/${params.documentId}/assets`);
                }
              }}
            />
            {/* <Popover>
              <PopoverTrigger className="w-full">
                <Item label="Trash" icon={Trash} />
              </PopoverTrigger>
              <PopoverContent side="top" className="p-0 w-72">
                <TrashBox />
              </PopoverContent>
            </Popover> */}
            <SidebarSeparator />
            <SidebarGroup>
              <div className="flex items-center justify-between px-4">
                <SidebarGroupLabel>Content</SidebarGroupLabel>
                {params.documentId && (
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent dark:hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="New page"
                    onClick={() => handleCreatePage()}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <SidebarGroupContent>
                {isLoading && document?.buildStatus === "BUILDING" ? (
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
                ) : displayTreeData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <Image
                      src="/empty.png"
                      height="200"
                      width="200"
                      alt="Empty"
                      className="dark:hidden"
                    />
                    <Image
                      src="/empty-dark.png"
                      height="200"
                      width="200"
                      alt="Empty"
                      className="hidden dark:block"
                    />
                    <p className="mt-2 text-sm text-muted-foreground">No files or folders yet</p>
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