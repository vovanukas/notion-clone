/* eslint-disable */
"use client";

import { useRef, useState, useEffect } from "react";
import { ImageIcon, Smile, X, Settings } from "lucide-react";
import { useMutation } from "convex/react";
import TextareaAutosize from "react-textarea-autosize";
import { useRouter, useParams } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { IconPicker } from "./icon-picker";
import { Button } from "./ui/button";
import { useCoverImage } from "@/hooks/use-cover-image";
import { Doc } from "@/convex/_generated/dataModel";
import { isImagePath } from "@/lib/utils";

interface ToolbarProps {
    initialData: Doc<"documents"> & { [key: string]: any };
    preview?: boolean;
    onTitleChange: (value: string) => void;
    showIconPicker?: boolean;
    filePath?: string;  // Optional: the file path for linking to settings
}

// Helper function to detect if there's an image in the metadata (including nested)
const hasImageInMetadata = (data: Doc<"documents"> & { [key: string]: any }): boolean => {
    // Recursive function to search for image paths in nested objects
    const searchForImages = (obj: any): boolean => {
        if (!obj || typeof obj !== 'object') return false;

        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string' && value.trim()) {
                // Check if the value looks like an image path using the utility function
                if (isImagePath(value)) {
                    return true;
                }

                // Check if the key name suggests it's an image
                const lowerKey = key.toLowerCase();
                if ((lowerKey.includes('image') || lowerKey.includes('cover') ||
                     lowerKey.includes('photo') || lowerKey.includes('picture') ||
                     lowerKey.includes('thumbnail') || lowerKey.includes('hero') ||
                     lowerKey.includes('banner')) && value.trim()) {
                    return true;
                }
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Recursively search nested objects
                if (searchForImages(value)) {
                    return true;
                }
            }
        }

        return false;
    };
    
    return searchForImages(data);
};

export const Toolbar = ({
    initialData,
    preview,
    onTitleChange,
    showIconPicker = true,
    filePath
}: ToolbarProps) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialData.title || '');
    const [pendingValue, setPendingValue] = useState(initialData.title || '');

    const router = useRouter();
    const params = useParams();
    const update = useMutation(api.documents.update);
    const removeIcon = useMutation(api.documents.removeIcon);
    const coverImage = useCoverImage();

    useEffect(() => {
        setValue(initialData.title || '');
        setPendingValue(initialData.title || '');
    }, [initialData.title]);

    const enableInput = () => {
        if (preview) return;

        setIsEditing(true);
        setTimeout(() => {
            setPendingValue(initialData.title);
            inputRef.current?.focus();
        }, 0);
    };

    const disableInput = () => setIsEditing(false);

    const handleTitleChange = (newValue: string) => {
        setPendingValue(newValue);
        onTitleChange(newValue);
    };

    const handleBlur = () => {
        onTitleChange(pendingValue);
        setValue(pendingValue);
        disableInput();
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if(event.key === "Enter") {
            event.preventDefault();
            onTitleChange(pendingValue);
            setValue(pendingValue);
            disableInput();
        }
    };

    const onIconSelect = (icon: string) => {
        update({
            id: initialData._id,
            icon,
        });
    };

    const onRemoveIcon = () => {
        removeIcon({
            id: initialData._id
        });
    };

    return (
        <div className="pl-[54px] group relative">
            {!!initialData.icon && !preview && showIconPicker && (
                <div className="flex items-center gap-x-2 group/icon pt-6">
                    <IconPicker onChange={onIconSelect}>
                        <p className="text-6xl hover:opacity-75 transition">
                            {initialData.icon}
                        </p>
                    </IconPicker>
                    <Button
                        onClick={onRemoveIcon}
                        className="rounded-full opacity-0 group-hover/icon:opacity-100 transition text-muted-foreground text-xs"
                        variant="outline"
                        size="icon"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
            {!!initialData.icon && preview && showIconPicker && (
                <p className="text-6xl pt-6">
                    {initialData.icon}
                </p>
            )}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-x-1 py-4">
                {!initialData.icon && !preview && showIconPicker && (
                    <IconPicker asChild onChange={onIconSelect}>
                        <Button
                            className="text-muted-foreground text-xs"
                            variant="outline"
                            size="sm"
                        >
                            <Smile className="h-4 w-4 mr-2" />
                            Add icon
                        </Button>
                    </IconPicker>
                )}
                {/* {!hasImageInMetadata(initialData) && !preview && (
                    <Button
                        onClick={coverImage.onOpen}
                        className="text-muted-foreground text-xs"
                        variant="outline"
                        size="sm"
                    >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Add cover
                    </Button>
                )} */}
                {!preview && filePath && (
                    <Button
                        onClick={() => {
                            const documentId = params.documentId;
                            router.push(`/documents/${documentId}/page-settings/${filePath}`);
                        }}
                        className="text-muted-foreground text-xs"
                        variant="outline"
                        size="sm"
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Page Settings
                    </Button>
                )}
            </div>
            {isEditing && !preview ? (
                <TextareaAutosize
                    ref={inputRef}
                    onBlur={handleBlur}
                    onKeyDown={onKeyDown}
                    value={pendingValue}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="text-5xl bg-transparent font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF] resize-none"
                />
            ) : (
                <div
                    onClick={enableInput}
                    className="pb-[11.5px] text-5xl font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF]"
                >
                    {value}
                </div>
            )}
        </div>
    );
};