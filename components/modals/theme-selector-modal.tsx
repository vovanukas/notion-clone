"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useThemeSelector } from "@/hooks/use-theme-selector";
import { useTemplateSelector } from "@/hooks/use-template-selector";
import { TemplateSelectorModal } from "./template-selector-modal";
import { toast } from "sonner";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

export const ThemeSelectorModal = () => {
  const themeSelector = useThemeSelector();
  const templateSelector = useTemplateSelector();
  const [siteName, setSiteName] = useState("");
  const create = useMutation(api.documents.create);
  const createRepo = useAction(api.github.createRepo);
  const router = useRouter();

  const handleChooseTemplate = () => {
    themeSelector.onClose();
    templateSelector.onOpen();
  };

  const handleCreateWebsite = () => {
    const promise = create({
      title: siteName,
      theme: templateSelector.selectedTemplate!
    }).then((documentId) => {
      router.push(`/documents/${documentId}`);
      return createRepo({
        repoName: documentId,
        siteName: siteName || "Untitled",
        siteTemplate: templateSelector.selectedTemplate!
      });
    });

    toast.promise(promise, {
      loading: "Creating your website...",
      success: "New website created!",
      error: "Failed to create a new website.",
    });
    setSiteName("");
    templateSelector.onSelect(null);
    themeSelector.onClose();
  };

  return (
    <>
      <Dialog open={themeSelector.isOpen} onOpenChange={themeSelector.onClose}>
        <DialogContent className="sm:max-w-[425px] flex flex-col min-h-[300px]">
          <DialogHeader>
            <DialogTitle>Create New Website</DialogTitle>
            <DialogDescription>
              {templateSelector.selectedTemplate
                ? `Using template: ${templateSelector.selectedTemplate} - Now give your website a name`
                : "Start by choosing a template, then give your website a name"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 flex-1">
            <div className="grid gap-2">
              <Label htmlFor="site-name">Website Name *</Label>
              <Input
                id="site-name"
                placeholder="Untitled"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-auto">
            <Button variant="outline" onClick={themeSelector.onClose}>
              Cancel
            </Button>
            <Button onClick={handleChooseTemplate}>
              Choose Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateSelectorModal onConfirm={handleCreateWebsite} />
    </>
  );
}; 