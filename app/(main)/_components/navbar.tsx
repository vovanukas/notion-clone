"use client";

import { useAction, useQuery } from "convex/react";
import { useParams, usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";
import { toast } from "sonner";
import { useEffect, useState } from "react";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MenuIcon } from "lucide-react";
import { Logo } from "@/app/(marketing)/_components/logo";

import { Title } from "./title";
import { Banner } from "./banner";
import { Menu } from "./menu";
import { Publish } from "./publish";
import { Button } from "@/components/ui/button";
import { useDocument } from "@/hooks/use-document";
import { useSettings } from "@/hooks/use-settings";

export const Navbar = () => {
  const saveContent = useAction(api.github.updateFileContent);
  const params = useParams();
  const pathname = usePathname();
  const documentId = params.documentId as Id<"documents">;
  const { toggleSidebar } = useSidebar();
  const [previousDocumentId, setPreviousDocumentId] = useState<string | null>(null);
  
  // Get document store state and functions
  const hasUnsavedChanges = useDocument(state => state.hasUnsavedChanges());
  const { unloadAllDocuments, prepareAllForGithub } = useDocument();

  // Get settings store state and functions
  const {
    hasUnsavedChanges: hasUnsavedSettingsChanges,
    saveFunction: settingsSaveFunction,
    isSaving: isSettingsSaving
  } = useSettings();

  // Check if we're on settings page
  const isOnSettingsPage = pathname?.includes('/settings') || false;

  const document = useQuery(
    api.documents.getById,
    !!params.documentId  ? { documentId: documentId } : "skip",
  )

  // Unload documents when switching between different websites
  useEffect(() => {
    if (previousDocumentId && previousDocumentId !== documentId) {
      unloadAllDocuments();
    }
    setPreviousDocumentId(documentId);
  }, [documentId, unloadAllDocuments, previousDocumentId]);

  const saveChanges = async () => {
    // Get files ready for GitHub
    const filesToUpdate = prepareAllForGithub();
    if (filesToUpdate.length === 0) return;

    const promise = saveContent({
      id: documentId,
      filesToUpdate
    }).then(() => {
      // Mark all documents as saved
      useDocument.getState().markAllSaved();
    });

    toast.promise(promise, {
      loading: "Saving and publishing changes...",
      success: "Changes saved! Your site is being published.",
      error: "Failed to save changes."
    });
  };

  const saveSettingsChanges = async () => {
    if (!settingsSaveFunction) return;

    const promise = settingsSaveFunction();

    toast.promise(promise, {
      loading: "Saving settings...",
      success: "Settings saved! Your site is being published.",
      error: "Failed to save settings."
    });
  };

  if (document === undefined) {
    return (
      <nav className="h-[--header-height] bg-background sticky top-0 dark:bg-[#1f1f1f] px-3 py-2 w-full flex items-center gap-x-4">
        <div className="flex h-[--header-height] w-full items-center gap-2 px-4">
          <Button
            className="h-8 w-8"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            <MenuIcon />
          </Button>
          <Logo />
        </div>
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
            <div className="flex items-center gap-x-2">
              <Title initialData={document} />
            </div>
            <div className="flex items-center gap-x-2">
              {/* Show appropriate save button based on page and unsaved changes */}
              {isOnSettingsPage && hasUnsavedSettingsChanges && (
                <Button
                  onClick={saveSettingsChanges}
                  disabled={isSettingsSaving}
                  className="flex items-center gap-2"
                >
                  {isSettingsSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </Button>
              )}
              {!isOnSettingsPage && hasUnsavedChanges && (
                <Button onClick={saveChanges}>Save</Button>
              )}
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
