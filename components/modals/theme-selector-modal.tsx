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
  const [siteName, setSiteName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validateInput = () => {
    if (!siteName) {
      setError("Site name is required");
      return false;
    }
    if (siteName.includes(" ")) {
      setError("Site name cannot contain spaces");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = () => {
    if (validateInput()) {
      themeSelector.onSubmit(siteName);
      setSiteName("");
      themeSelector.onClose();
    }
  };

  return (
    <Dialog open={themeSelector.isOpen} onOpenChange={themeSelector.onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Site</DialogTitle>
          <DialogDescription>
            Enter the name of the site you want to use (e.g., ananke)
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="site-name">Site Name *</Label>
            <Input
              id="site-name"
              placeholder="e.g., ananke"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className={error ? "border-red-500" : ""}
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