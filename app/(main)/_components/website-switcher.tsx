"use client"

import * as React from "react"
import { ChevronsUpDown, Plus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useParams, useRouter } from "next/navigation"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Icon } from "@radix-ui/react-select"
import { toast } from "sonner"
import { useThemeSelector } from "@/hooks/use-theme-selector"

export const WebsiteSwitcher = () => {
  const params = useParams();
  const router = useRouter();
  const { isMobile } = useSidebar()
  const themeSelector = useThemeSelector();
  const [open, setOpen] = React.useState(false);

  const create = useMutation(api.documents.create);
  const createRepo = useAction(api.github.createRepo);

  const documents = useQuery(api.documents.getWebsites, {});
  const currentDocument = useQuery(
    api.documents.getById,
    !!params.documentId  ? { documentId: params.documentId as Id<"documents"> } : "skip",
  )

  const onRedirect = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  const handleCreate = () => {
    setOpen(false);
    themeSelector.onOpen();
  };

  React.useEffect(() => {
    const handleThemeSubmit = async (themeUrl: string) => {
      const promise = create({ title: "Untitled" }).then((documentId) => {
        router.push(`/documents/${documentId}`);
        return createRepo({ repoName: documentId, themeUrl });
      });

      toast.promise(promise, {
        loading: "Creating your website...",
        success: "New website created!",
        error: "Failed to create a new website.",
      });
    };

    themeSelector.onSubmit = handleThemeSubmit;
  }, [create, createRepo, router, themeSelector]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {currentDocument?.icon ? currentDocument.icon : <Icon />}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {currentDocument?.title}
                </span>
                <span className="truncate text-xs">Team Plan</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Websites
            </DropdownMenuLabel>
            {documents?.map((document, index) => (
              <DropdownMenuItem
                key={document._id}
                title={document.title}
                onClick={() => onRedirect(document._id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  {document?.icon ? document.icon : <Icon />}
                </div>
                {document.title}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={handleCreate}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Add website</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
