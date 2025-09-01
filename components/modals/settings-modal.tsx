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
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import yaml from 'js-yaml';
import Editor from "@monaco-editor/react";

export const SettingsModal = () => {
  const pageSettings = usePageSettings();
  const params = useParams();
  const { getFileChanges, updateFile } = useUnsavedChanges();

  const filePathParam = params.filePath as string[];
  const filePathString = filePathParam?.join('/') || '';
  const decodedPath = decodeURIComponent(filePathString);

  // Get the current file state from unsaved changes
  const currentFile = getFileChanges(decodedPath);

  // Convert metadata object to YAML string for display
  const frontmatterString = currentFile ? yaml.dump(
    Object.fromEntries(
      Object.entries(currentFile)
        .filter(([key]) => !['content', 'path', 'sha', 'isEdited'].includes(key))
    )
  ) : '';

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;

    try {
      // Parse YAML back to object
      const newMetadata = yaml.load(value) as Record<string, any>;

      // Update the file with new metadata while preserving content and path
      updateFile(decodedPath, {
        ...newMetadata,
        content: currentFile?.content || '',
        sha: currentFile?.sha
      });
    } catch (err) {
      console.error('Failed to parse YAML:', err);
    }
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