"use client";

import { useAction, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MenuIcon } from "lucide-react";

import { Title } from "./title";
import { Banner } from "./banner";
import { Menu } from "./menu";
import { Publish } from "./publish";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

export const Navbar = () => {
  const saveContent = useAction(api.github.updateFileContent);
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as Id<"documents">;
  const { changedFiles } = useUnsavedChanges();
  const { toggleSidebar } = useSidebar();
  const { resetChangedFiles } = useUnsavedChanges();

  const document = useQuery(
    api.documents.getById,
    !!params.documentId  ? { documentId: documentId } : "skip",
  )

  const saveChanges = async () => {
    const promise = saveContent({
      id: documentId,
      filesToUpdate: changedFiles
    }).then(() => {
      resetChangedFiles();
      router.refresh();
    });

    toast.promise(promise, {
      loading: "Saving changes...",
      success: "Changes saved successfully!",
      error: "Failed to save changes."
    });
  };

  if (document === undefined) {
    return (
      <nav className="h-[--header-height] bg-background sticky top-0 dark:bg-[#1f1f1f] px-3 py-2 w-full flex items-center gap-x-4">
        <Title.Skeleton />
        <div className="flex items-center gap-x-2">
          <Menu.Skeleton />
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="z-[99999] h-[--header-height] bg-background sticky top-0 dark:bg-[#1f1f1f] px-3 py-2 w-full flex items-center gap-x-4">
        <div className="flex h-[--header-height] w-full items-center gap-2 px-4">
          <Button
            className="h-8 w-8"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            <MenuIcon />
          </Button>
          <div className="flex items-center justify-between w-full">
            <Title initialData={document} />
            <div className="flex items-center gap-x-2">
              {changedFiles.length !== 0 && <Button onClick={saveChanges}>Save</Button>}
              <Publish initialData={document} />
              <Menu documentId={document._id} />
            </div>
          </div>
        </div>
      </nav>
      {document.isArchived && <Banner documentId={document._id} />}
    </>
  );
};
