"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input"
import { useAction } from "convex/react";
import { useSettings } from "@/hooks/use-settings";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const SettingsModal = () => {
    const settings = useSettings();
    const params = useParams();
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const fetchAndParseConfigToml = useAction(api.github.fetchAndParseConfigToml);

    useEffect(() => {
        async function loadConfig() {
          try {
            const config = await fetchAndParseConfigToml({ id: params.documentId as Id<"documents"> });
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
    }, [settings.isOpen]);

    const handleInputChange = (key: string, value: string | number | boolean) => {
    setConfig((prevConfig) => ({
        ...prevConfig,
        [key]: value,
    }));
    };

    const handleSave = () => {
        // Implement save logic here, such as sending updated config back to the server
        console.log("Updated Config:", config);

        // Close the modal after saving
        settings.onClose();
    };

    const renderInputs = () => {
        if (!config) return null;

        return Object.keys(config).map((key) => {
          const value = config[key];
          return (
            <div key={key} className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor={key} className="text-right capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </Label>
              <Input
                id={key}
                value={String(value)}
                onChange={(e) => handleInputChange(key, e.target.value)}
                className="col-span-3"
              />
            </div>
          );
        });
      };

    return(
        <Dialog open={settings.isOpen} onOpenChange={settings.onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Modify your site settings. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>

                {loading && <p>Loading settings...</p>}
                {error && <p style={{ color: "red" }}>Error: {error}</p>}
                <div className="grid gap-4 py-4 overflow-y-auto" style={{ maxHeight: '400px' }}>
                    {renderInputs()}
                </div>

                <DialogFooter>
                    <Button type="button" onClick={handleSave}>
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}