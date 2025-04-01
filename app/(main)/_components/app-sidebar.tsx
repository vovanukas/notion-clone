"use client";

import React, { useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearch } from "@/hooks/use-search";
import { useSettings } from "@/hooks/use-settings";
import { useParams, useRouter } from "next/navigation";
import { useAppSidebar } from "@/hooks/use-app-sidebar";
import { toast } from "sonner";
import {
  ChevronRight,
  File,
  Folder,
  PlusCircle,
  Search,
  Settings,
  Trash,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { UserItem } from "./user-item";
import { Item } from "./item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrashBox } from "./trash-box";
import { WebsiteSwitcher } from "./website-switcher";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Id } from "@/convex/_generated/dataModel";

interface TreeNode {
  name?: string;
  path?: string;
  type?: string;
  children?: TreeNode[];
  sha?: string;
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { treeData, setItems, isLoading, setIsLoading, error, setError } = useAppSidebar();

  const settings = useSettings();
  const search = useSearch();
  const router = useRouter();
  const params = useParams();

  const create = useMutation(api.documents.create);
  const createRepo = useAction(api.github.createRepo);
  const fetchContentTree = useAction(api.github.fetchGitHubFileTree);

  useEffect(() => {
    async function loadFileTree() {
      if (!params.documentId) return;

      try {
        setIsLoading(true);
        const result = await fetchContentTree({
          id: params.documentId as Id<"documents">,
        });
        setItems(result);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch GitHub file tree:", err);
        setError("Failed to load file structure. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }
    loadFileTree();
  }, [fetchContentTree, params.documentId, setIsLoading, setItems, setError]);

  const handleCreate = () => {
    const promise = create({ title: "Untitled" }).then((documentId) => {
      router.push(`/documents/${documentId}`);
      return createRepo({ repoName: documentId });
    });

    toast.promise(promise, {
      loading: "Creating a note...",
      success: "New note created!",
      error: "Failed to create a new note.",
    });
  };

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
            <Item onClick={handleCreate} label="New Page" icon={PlusCircle} />
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
                {isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    Loading file structure...
                  </div>
                ) : error ? (
                  <div className="p-4 text-sm text-destructive">{error}</div>
                ) : (
                  <SidebarMenu>
                    {treeData.map((item) => (
                      <Tree key={item.sha} item={item} />
                    ))}
                  </SidebarMenu>
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

function Tree({ item }: { item: TreeNode }) {
  const { type, path, name, children } = item;
  const router = useRouter();
  const params = useParams();

  const onRedirect = (documentId: string) => {
    router.push(`/documents/${documentId}/${path}`);
  };

  if (type === "blob") {
    return (
      <SidebarMenuButton
        onClick={() => onRedirect(params.documentId as Id<"documents">)}
        className="data-[active=true]:bg-transparent"
      >
        <File />
        {name}
      </SidebarMenuButton>
    );
  }

  if (children) {
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
          <CollapsibleContent>
            <SidebarMenuSub>
              {children.map((child) => (
                <Tree key={child.sha} item={child} />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    );
  }
}