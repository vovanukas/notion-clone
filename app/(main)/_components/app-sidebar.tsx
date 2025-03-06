"use client"

import * as React from "react"

import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import { useSearch } from "@/hooks/use-search";
import { useSettings } from "@/hooks/use-settings";
import { useParams, usePathname, useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  Command,
  PlusCircle,
  Search,
  Settings,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar"
import { UserItem } from "./user-item"
import { Item } from "./item"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const settings = useSettings();
  const search = useSearch();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  const create = useMutation(api.documents.create);
  const createRepo = useAction(api.github.createRepo);

  const handleCreate = () => {
    const promise = create({ title: "Untitled" })
      .then((documentId) => {
        router.push(`/documents/${documentId}`);
        return createRepo({ repoName: documentId});
      })

    toast.promise(promise, {
      loading: "Creating a note...",
      success: "New note created!",
      error: "Failed to create a new note.",
    });
  };

  return (
    <Sidebar className="top-[--header-height] !h-[calc(100svh-var(--header-height))]"
    {...props}
    >
      <SidebarContent>
        <Item label="Search" icon={Search} isSearch onClick={search.onOpen} />
        <Item label="Settings" icon={Settings} onClick={settings.onOpen} />
        <Item onClick={handleCreate} label="New Page" icon={PlusCircle} />
      </SidebarContent>
      <SidebarFooter>
        <UserItem />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
