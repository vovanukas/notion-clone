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
      <DialogContent className="w-[95vw] max-w-[400px] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[800px] xl:max-w-[900px] h-[90vh] max-h-[600px] md:max-h-[700px] lg:max-h-[800px]">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
          <DialogDescription>
            Modify your page frontmatter. Don&apos;t forget to save your changes in the Navigation Bar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid gap-4 py-4 overflow-hidden">
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              language="yaml"
              value={frontmatterString}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                fontSize: 12,
              }}
            />
          </div>
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