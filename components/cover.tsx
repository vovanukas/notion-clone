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
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
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
    const { updateFile, changedFiles, resetChangedFiles } = useUnsavedChanges();
    const saveContent = useAction(api.github.updateFileContent);
    const [isRemoving, setIsRemoving] = useState(false);

    const onRemove = async () => {
        if (url && !isRemoving) {
            setIsRemoving(true);
            const promise = (async () => {
                try {
                    // Delete the image from GitHub
                    const imagePath = url.split('/images/')[1];
                    await deleteImage({
                        id: params.documentId as Id<"documents">,
                        imagePath: `images/${imagePath}`
                    });

                    const filePathString = Array.isArray(params.filePath) ? params.filePath.join('/') : params.filePath;
                    
                    // Update the file to remove the featured_image
                    updateFile(
                        filePathString as string,
                        {
                            featured_image: undefined
                        }
                    );

                    // Save the changes
                    await saveContent({
                        id: params.documentId as Id<"documents">,
                        filesToUpdate: changedFiles
                    });
                    resetChangedFiles();

                    // Force a hard refresh of the page
                    router.refresh();
                } catch (error) {
                    console.error("Error removing cover image:", error);
                    // Even if the image deletion fails, we should still try to update the metadata
                    try {
                        const filePathString = Array.isArray(params.filePath) ? params.filePath.join('/') : params.filePath;
                        updateFile(
                            filePathString as string,
                            {
                                featured_image: undefined
                            }
                        );
                        await saveContent({
                            id: params.documentId as Id<"documents">,
                            filesToUpdate: changedFiles
                        });
                        resetChangedFiles();
                        router.refresh();
                    } catch (updateError) {
                        console.error("Failed to update metadata:", updateError);
                        toast.error("Failed to update metadata. Please try again.");
                    }
                    throw error;
                } finally {
                    setIsRemoving(false);
                }
            })();

            toast.promise(promise, {
                loading: "Removing cover image...",
                success: "Cover image removed successfully!",
                error: "Failed to remove cover image."
            });
        }
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