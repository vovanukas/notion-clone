"use client";

import { ChevronRight, File, Folder, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import { FileItem } from "./file-item";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAppSidebar, GitHubList } from "@/hooks/use-app-sidebar";

interface TreeNode {
  name?: string;
  path?: string;
  type?: string;
  children?: TreeNode[];
  sha?: string;
}

interface FolderItemProps {
  item: TreeNode;
}

function Tree({ item }: { item: TreeNode }) {
  const { type } = item;

  if (type === "blob") {
    return <FileItem item={item} />;
  }

  return <FolderItem item={item} />;
}

export const FolderItem = ({ item }: FolderItemProps) => {
  const { name, children } = item;
  const createMarkdownFile = useAction(api.github.createMarkdownFileInRepo);
  const fetchContentTree = useAction(api.github.fetchGitHubFileTree);
  const { documentId } = useParams();
  const { setIsLoading, setItems, setError } = useAppSidebar();

  const onCreateFolder = async () => {
    if (!documentId) return;
    const folderName = window.prompt("Enter new folder name:");
    if (!folderName) return;
    setIsLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const parentPath = item.path ? item.path : "";
    const filePath = parentPath ? `${parentPath}/${folderName}/_index.md` : `${folderName}/_index.md`;
    const content = `---\ntitle: \"${folderName}\"\ndate: ${today}\n---\n`;
    try {
      await createMarkdownFile({
        id: documentId as import("@/convex/_generated/dataModel").Id<"documents">,
        filePath: `content/${filePath}`,
        content,
      });
      let result = await fetchContentTree({
        id: documentId as import("@/convex/_generated/dataModel").Id<"documents">,
      });
      if (result) {
        result = result
          .map((item: { path?: string; type?: string; sha?: string }) => ({
            path: typeof item.path === "string" ? item.path : "",
            type: typeof item.type === "string" ? item.type : "blob",
            sha: typeof item.sha === "string" ? item.sha : "",
          }))
          .filter((item: { path: string; type: string; sha: string }) => item.path && item.type && item.sha);
        setItems(result as GitHubList[]);
      }
      setError(null);
    } catch (err) {
      setError("Failed to refresh sidebar. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const onCreatePage = async () => {
    if (!documentId) return;
    const pageName = window.prompt("Enter new page name:");
    if (!pageName) return;
    setIsLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const parentPath = item.path ? item.path : "";
    const filePath = parentPath ? `${parentPath}/${pageName}.md` : `${pageName}.md`;
    const content = `---\ntitle: "${pageName}"\ndate: ${today}\n---\n`;
    try {
      await createMarkdownFile({
        id: documentId as import("@/convex/_generated/dataModel").Id<"documents">,
        filePath: `content/${encodeURIComponent(filePath)}`,
        content,
      });
      let result = await fetchContentTree({
        id: documentId as import("@/convex/_generated/dataModel").Id<"documents">,
      });
      if (result) {
        result = result
          .map((item: { path?: string; type?: string; sha?: string }) => ({
            path: typeof item.path === "string" ? item.path : "",
            type: typeof item.type === "string" ? item.type : "blob",
            sha: typeof item.sha === "string" ? item.sha : "",
          }))
          .filter((item: { path: string; type: string; sha: string }) => item.path && item.type && item.sha);
        setItems(result as GitHubList[]);
      }
      setError(null);
    } catch (err) {
      setError("Failed to refresh sidebar. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        defaultOpen={false}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <ChevronRight className="transition-transform" />
            <Folder />
            {name}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction showOnHover>
              <Plus className="size-4" />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[200px]"
            align="start"
            side="right"
            sideOffset={4}
          >
            <DropdownMenuItem 
              className="gap-2 p-2"
              onClick={onCreateFolder}
            >
              <Folder className="size-4" />
              <span>New Folder</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="gap-2 p-2"
              onClick={onCreatePage}
            >
              <File className="size-4" />
              <span>New Page</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children?.map((child) => (
              <Tree key={child.sha} item={child} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}; 