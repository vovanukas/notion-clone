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
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/clerk-react";
import { Crown } from "lucide-react";

export const ThemeSelectorModal = () => {
  const themeSelector = useThemeSelector();
  const [siteName, setSiteName] = useState("");
  const create = useMutation(api.documents.create);
  const createRepo = useAction(api.github.createRepo);
  const router = useRouter();
  const { user } = useUser();
  const siteCount = useQuery(api.documents.getUserSiteCount);

  const isPremium = user?.publicMetadata?.isPremium === true;
  const hasReachedLimit = !isPremium && siteCount !== undefined && siteCount >= 2;

  const handleCreateWebsite = () => {
    const promise = create({
      title: siteName,
      theme: "doks-template"
    }).then((documentId) => {
      router.push(`/documents/${documentId}`);
      return createRepo({
        repoName: documentId,
        siteName: siteName || "Untitled",
        siteTemplate: "doks-template"
      });
    });

    toast.promise(promise, {
      loading: "Creating your website...",
      success: "New website created!",
      error: "Failed to create a new website.",
    });
    setSiteName("");
    themeSelector.onClose();
  };

  const handleUpgrade = () => {
    window.location.href = "https://www.hugity.com/pricing/";
  };

  // If user has reached their site limit, show upgrade modal
  if (hasReachedLimit) {
    return (
      <Dialog open={themeSelector.isOpen} onOpenChange={themeSelector.onClose}>
        <DialogContent className="sm:max-w-[425px] flex flex-col min-h-[300px]">
          <DialogHeader>
            <DialogTitle>Site Limit Reached</DialogTitle>
            <DialogDescription>
              You have reached the limit of your free sites. Need more sites? Consider upgrading to premium!
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-8 flex-1">
            <Crown className="h-16 w-16 text-yellow-500 mb-4" />
            <p className="text-sm text-muted-foreground text-center mb-4">
              Free users can create up to 2 sites. Upgrade to premium for unlimited sites and more features!
            </p>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-auto">
            <Button variant="outline" onClick={themeSelector.onClose}>
              Close
            </Button>
            <Button onClick={handleUpgrade} className="bg-yellow-500 hover:bg-yellow-600">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Premium
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Normal site creation flow
  return (
    <Dialog open={themeSelector.isOpen} onOpenChange={themeSelector.onClose}>
      <DialogContent className="sm:max-w-[425px] flex flex-col min-h-[300px]">
        <DialogHeader>
          <DialogTitle>Create New Website</DialogTitle>
          <DialogDescription>
            Give your new website a name to get started.
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateWebsite();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-auto">
          <Button variant="outline" onClick={themeSelector.onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreateWebsite}>
            Create Website
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 