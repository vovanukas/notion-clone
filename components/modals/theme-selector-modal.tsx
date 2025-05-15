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
import { useThemeSelector } from "@/hooks/use-theme-selector";

export const ThemeSelectorModal = () => {
  const themeSelector = useThemeSelector();
  const [themeUrl, setThemeUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateThemeUrl = (url: string) => {
    if (!url) {
      setError("Theme URL is required");
      return false;
    }
    if (url.includes(" ")) {
      setError("Theme URL cannot contain spaces");
      return false;
    }
    if (!url.includes("github.com") && !url.includes("gitlab.com")) {
      setError("Theme URL must be from GitHub or GitLab");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = () => {
    if (validateThemeUrl(themeUrl)) {
      themeSelector.onSubmit(themeUrl);
      setThemeUrl("");
      themeSelector.onClose();
    }
  };

  return (
    <Dialog open={themeSelector.isOpen} onOpenChange={themeSelector.onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Theme</DialogTitle>
          <DialogDescription>
            Enter the GitHub/GitLab URL for your Hugo theme
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            placeholder="https://github.com/username/theme"
            value={themeUrl}
            onChange={(e) => setThemeUrl(e.target.value)}
            className={error ? "border-red-500" : ""}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={themeSelector.onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 