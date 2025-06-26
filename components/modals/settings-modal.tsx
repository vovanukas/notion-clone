"use client";

import React, { useEffect, useState } from "react";
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
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Spinner } from "../spinner";
import Editor from "@monaco-editor/react";

export const SettingsModal = () => {
  const pageSettings = usePageSettings();
  const params = useParams();
  const [frontmatter, setFrontmatter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>("");
  
  const fetchFileContent = useAction(api.github.fetchAndReturnGithubFileContent);
  const createMarkdownFileInRepo = useAction(api.github.createMarkdownFileInRepo);

  const documentId = params.documentId as Id<"documents">;
  const filePathParam = params.filePath as string[];

  useEffect(() => {
    async function loadFrontmatter() {
      if (!pageSettings.isOpen || !documentId || !filePathParam) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const filePathString = filePathParam.join('/');
        const decodedPath = decodeURIComponent(filePathString);
        setFilePath(decodedPath);
        
        const fileContent = await fetchFileContent({
          id: documentId,
          path: `content/${decodedPath}`,
        });

        // Extract frontmatter from markdown file
        const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          setFrontmatter(frontmatterMatch[1]);
        } else {
          setFrontmatter("");
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    loadFrontmatter();
  }, [pageSettings.isOpen, documentId, filePathParam, fetchFileContent]);

  const handleEditorChange = (value: string | undefined) => {
    setFrontmatter(value || "");
  };

  const handleSave = async () => {
    try {
      // Get the current file content to preserve the markdown content
      const currentFileContent = await fetchFileContent({
        id: documentId,
        path: `content/${filePath}`,
      });

      // Extract the markdown content (everything after the frontmatter)
      const contentMatch = currentFileContent.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
      const markdownContent = contentMatch ? contentMatch[1] : currentFileContent;

      // Create new file content with updated frontmatter
      const newFileContent = `---\n${frontmatter}\n---\n${markdownContent}`;

      await createMarkdownFileInRepo({
        id: documentId,
        filePath: `content/${filePath}`,
        content: newFileContent,
      });

      pageSettings.onClose();
    } catch (err) {
      setError("Failed to save frontmatter: " + (err as Error).message);
    }
  };

  return (
    <Dialog open={pageSettings.isOpen} onOpenChange={pageSettings.onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
          <DialogDescription>
            Modify your page frontmatter. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>

        {loading && <Spinner size="lg" />}
        {error && <p style={{ color: "red" }}>Error: {error}</p>}
        <div
          className="grid gap-4 py-4 overflow-y-auto"
          style={{ maxHeight: "400px" }}
        >
          <Editor
            height="300px"
            defaultLanguage="yaml"
            language="yaml"
            value={frontmatter}
            onChange={handleEditorChange}
            theme="vs-dark"
          />
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSave}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};