"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ImageIcon, X } from "lucide-react";
import { useCoverImage } from "@/hooks/use-cover-image";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useDocument } from "@/hooks/use-document";
import { useState } from "react";

interface coverImageProps {
    url?:string;
    preview?:boolean;
}

export const Cover = ({url, preview}: coverImageProps) => {
    const params = useParams();
    const router = useRouter();
    const coverImage = useCoverImage();
    const deleteImage = useAction(api.github.deleteImage);
    const { updateFrontmatterParsed } = useDocument();
    const saveContent = useAction(api.github.updateFileContent);
    const [isRemoving, setIsRemoving] = useState(false);

    const onRemove = async () => {
        if (!url || isRemoving) return;

        if (!params.filePath) {
            toast.error("File path not found");
            return;
        }
        const filePathString = Array.isArray(params.filePath) ? params.filePath.join('/') : params.filePath;
        const doc = useDocument.getState().documents.get(filePathString);
        
        if (!doc) {
            toast.error("Document not found");
            return;
        }

        // Get the image key from the document
        const imageKey = doc.imageKey;
        if (!imageKey) {
            toast.error("Image key not found in document");
            return;
        }

        setIsRemoving(true);
        const promise = (async () => {
            try {
                // First, try to delete the image from GitHub
                const imagePath = url.split('/images/')[1];
                await deleteImage({
                    id: params.documentId as Id<"documents">,
                    imagePath: `images/${imagePath}`
                });

                // Update frontmatter to remove image
                const newFrontmatter = { ...doc.frontmatter.parsed };
                delete newFrontmatter[imageKey];
                
                // Update store first, then prepare for GitHub
                updateFrontmatterParsed(filePathString, newFrontmatter);
                const fileForGithub = useDocument.getState().prepareForGithub(filePathString);
                if (!fileForGithub) {
                    throw new Error("Failed to prepare file for GitHub");
                }

                // Save the updated content to GitHub
                await saveContent({
                    id: params.documentId as Id<"documents">,
                    filesToUpdate: [{
                        path: fileForGithub.path,
                        content: fileForGithub.content
                    }]
                });

                // Local state is already updated, just refresh the UI
                
                // Force a refresh to get the latest content
                router.refresh();
            } catch (error) {
                console.error("Error removing cover image:", error);
                throw error; // Re-throw to trigger error toast
            } finally {
                setIsRemoving(false);
            }
        })();

        toast.promise(promise, {
            loading: "Removing cover image and publishing changes...",
            success: "Cover image removed! Your site is being published.",
            error: "Failed to remove cover image."
        });
    }
    
    return (
        <div className={cn(
            "relative w-full h-[35vh] group",
            !url && "h-[12vh]",
            url && "bg-muted"
        )}>
            {!!url && (
                <Image 
                    src={url}
                    fill
                    alt="Cover"
                    className="object-cover"
                />
            )}
            {url && !preview && !isRemoving && (
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-5 right-5 flex items-center gap-x-2">
                    <Button
                        onClick={() => coverImage.onReplace(url)}
                        className="text-muted-foreground text-xs"
                        variant="outline"
                        size="sm"
                        disabled={isRemoving}
                    >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Change cover
                    </Button>
                    <Button
                        onClick={onRemove}
                        className="text-muted-foreground text-xs"
                        variant="outline"
                        size="sm"
                        disabled={isRemoving}
                    >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                    </Button>
                </div>
            )}
        </div>
    )
}

Cover.Skeleton = function CoverSkeleton() {
    return (
        <Skeleton className="w-full h-[12vh]" />
    )
}