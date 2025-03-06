"use client";

import * as React from "react";

import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import { useSearch } from "@/hooks/use-search";
import { useSettings } from "@/hooks/use-settings";
import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { PlusCircle, Search, Settings, Trash } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { UserItem } from "./user-item";
import { Item } from "./item";
import { DocumentList } from "./document-list";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrashBox } from "./trash-box";
import { WebsiteSwitcher } from "./website-switcher";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const settings = useSettings();
  const search = useSearch();
  const router = useRouter();

  const create = useMutation(api.documents.create);
  const createRepo = useAction(api.github.createRepo);

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
        <WebsiteSwitcher teams={[
    {
      name: "Acme Inc",
      logo: PlusCircle,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: Search,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Settings,
      plan: "Free",
    },
  ]} />
      </SidebarHeader>
      <SidebarContent>
        <Item label="Search" icon={Search} isSearch onClick={search.onOpen} />
        <Item label="Settings" icon={Settings} onClick={settings.onOpen} />
        <Item onClick={handleCreate} label="New Page" icon={PlusCircle} />
        <SidebarSeparator />
        <DocumentList />
        <SidebarSeparator />
      </SidebarContent>
      <SidebarFooter>
      <Popover>
          <PopoverTrigger className="w-full">
            <Item label="Trash" icon={Trash} />
          </PopoverTrigger>
          <PopoverContent
            side="top"
            className="p-0 w-72"
          >
            <TrashBox />
          </PopoverContent>
        </Popover>
        <UserItem />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
