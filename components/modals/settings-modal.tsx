// TODO: Change to a form? Monaco editor might be too "codey" for regular people
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
import { useAction } from "convex/react";
import { useSettings } from "@/hooks/use-settings";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Spinner } from "../spinner";
import Editor from "@monaco-editor/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";

export const SettingsModal = () => {
  const settings = useSettings();
  const params = useParams();
  const router = useRouter();
  const [config, setConfig] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fetchAndReturnConfigToml = useAction(api.github.fetchAndReturnGithubFileContent);
  const parseAndSaveSettingsObject = useAction(api.github.parseAndSaveSettingsObject);
  const remove = useMutation(api.documents.remove);
  const deleteRepo = useAction(api.github.deleteRepo);

  const id = params.documentId as Id<"documents">;

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await fetchAndReturnConfigToml({
          id: id,
          path: "config.toml",
        });
        setConfig(config);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    if (settings.isOpen) {
      loadConfig();
    }
  }, [settings.isOpen, fetchAndReturnConfigToml, id]);

  const handleEditorChange = (value: string | undefined) => {
    setConfig(value || "");
  };

  const handleSave = () => {
    try {
    parseAndSaveSettingsObject({
        id: id,
        newSettings: config,
    });

    settings.onClose();
    } catch (err) {
      setError("Invalid JSON: " + (err as Error).message);
    }
  };

  const handleDelete = async () => {
    try {
      settings.onClose();
      router.push("/documents");
      await Promise.all([
        deleteRepo({ id }),
        remove({ id })
      ]);
    } catch (err) {
      setError("Failed to delete repository: " + (err as Error).message);
    }
  };

        return (
    <Dialog open={settings.isOpen} onOpenChange={settings.onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Modify your site settings. Click save when you&apos;re done.
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
            defaultLanguage="ini"
            value={config}
            onChange={handleEditorChange}
            theme="vs-dark"
          />
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
          >
            Delete Permanently
          </Button>
          <Button type="button" onClick={handleSave}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};