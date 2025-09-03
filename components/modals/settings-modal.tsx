"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { usePageSettings } from "@/hooks/use-page-settings";
import { useParams } from "next/navigation";
import { useDocument } from "@/hooks/use-document";
import Editor from "@monaco-editor/react";

export const SettingsModal = () => {
  const pageSettings = usePageSettings();
  const params = useParams();

  const filePathParam = params.filePath as string[];
  const filePathString = filePathParam?.join('/') || '';
  const decodedPath = decodeURIComponent(filePathString);

  // Get document from store
  const { updateFrontmatterRaw } = useDocument();
  const currentDocument = useDocument(state => state.documents.get(decodedPath));

  // Get raw frontmatter for display
  const frontmatterString = currentDocument?.frontmatter.raw || '';

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;

    // Update frontmatter in document store
    updateFrontmatterRaw(decodedPath, value);
  };

  return (
    <Dialog open={pageSettings.isOpen} onOpenChange={pageSettings.onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
          <DialogDescription>
            Modify your page frontmatter. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div
          className="grid gap-4 py-4 overflow-y-auto"
          style={{ maxHeight: "400px" }}
        >
          <Editor
            height="300px"
            defaultLanguage="yaml"
            language="yaml"
            value={frontmatterString}
            onChange={handleEditorChange}
            theme="vs-dark"
          />
        </div>

        <DialogFooter>
          <Button type="button" onClick={pageSettings.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};