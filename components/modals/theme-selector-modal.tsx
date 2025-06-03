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

export const ThemeSelectorModal = () => {
  const themeSelector = useThemeSelector();
  const [themeUrl, setThemeUrl] = useState("");
  const [exampleSiteUrl, setExampleSiteUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateInputs = () => {
    if (!themeUrl) {
      setError("Theme URL is required");
      return false;
    }
    if (!exampleSiteUrl) {
      setError("Example Site URL is required");
      return false;
    }
    if (themeUrl.includes(" ")) {
      setError("Theme URL cannot contain spaces");
      return false;
    }
    if (!themeUrl.includes("github.com") && !themeUrl.includes("gitlab.com")) {
      setError("Theme URL must be from GitHub or GitLab");
      return false;
    }
    if (exampleSiteUrl.includes(" ")) {
      setError("Example Site URL cannot contain spaces");
      return false;
    }
    if (!exampleSiteUrl.includes("github.com") && !exampleSiteUrl.includes("gitlab.com")) {
      setError("Example Site URL must be from GitHub or GitLab");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = () => {
    if (validateInputs()) {
      themeSelector.onSubmit(themeUrl, exampleSiteUrl);
      setThemeUrl("");
      setExampleSiteUrl("");
      themeSelector.onClose();
    }
  };

  return (
    <Dialog open={themeSelector.isOpen} onOpenChange={themeSelector.onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Theme</DialogTitle>
          <DialogDescription>
            Enter the GitHub/GitLab URLs for your Hugo theme and example site
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="theme-url">Theme URL *</Label>
            <Input
              id="theme-url"
              placeholder="https://github.com/username/theme"
              value={themeUrl}
              onChange={(e) => setThemeUrl(e.target.value)}
              className={error && error.includes("Theme URL") ? "border-red-500" : ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="example-site-url">Example Site URL *</Label>
            <Input
              id="example-site-url"
              placeholder="https://github.com/username/example-site"
              value={exampleSiteUrl}
              onChange={(e) => setExampleSiteUrl(e.target.value)}
              className={error && error.includes("Example Site URL") ? "border-red-500" : ""}
            />
          </div>
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