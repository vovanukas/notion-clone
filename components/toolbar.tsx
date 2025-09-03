"use client";

import { useRef, useState, useEffect } from "react";
import { ImageIcon, Smile, X, Settings } from "lucide-react";
import { useMutation } from "convex/react";
import TextareaAutosize from "react-textarea-autosize";

import { api } from "@/convex/_generated/api";
import { IconPicker } from "./icon-picker";
import { Button } from "./ui/button";
import { useCoverImage } from "@/hooks/use-cover-image";
import { usePageSettings } from "@/hooks/use-page-settings";
import { Doc } from "@/convex/_generated/dataModel";

interface ToolbarProps {
    initialData: Doc<"documents"> & { [key: string]: any };
    preview?: boolean;
    onTitleChange: (value: string) => void;
    showIconPicker?: boolean;
}

// Helper function to detect if there's an image in the metadata
const hasImageInMetadata = (data: Doc<"documents"> & { [key: string]: any }): boolean => {
    // Common image key patterns
    const imageKeys = [
        'featured_image', 'image', 'cover', 'coverImage', 'cover_image',
        'thumbnail', 'hero_image', 'banner', 'photo', 'picture'
    ];
    
    // Check for exact key matches
    for (const key of imageKeys) {
        if (data[key] && typeof data[key] === 'string' && data[key].trim()) {
            return true;
        }
    }
    
    // Check for any key that contains image-like patterns and has a value that looks like an image path
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|tiff)$/i;
    const imagePaths = /\/(images?|assets|media|static|public)\//i;
    
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.trim()) {
            // Check if the value looks like an image path
            if (imageExtensions.test(value) || imagePaths.test(value)) {
                return true;
            }
            // Check if the key name suggests it's an image
            if (key.toLowerCase().includes('image') || key.toLowerCase().includes('cover') || 
                key.toLowerCase().includes('photo') || key.toLowerCase().includes('picture')) {
                return true;
            }
        }
    }
    
    return false;
};

export const Toolbar = ({
    initialData,
    preview,
    onTitleChange,
    showIconPicker = true
}: ToolbarProps) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(initialData.title || '');
    const [pendingValue, setPendingValue] = useState(initialData.title || '');

    const update = useMutation(api.documents.update);
    const removeIcon = useMutation(api.documents.removeIcon);
    const coverImage = useCoverImage();
    const pageSettings = usePageSettings();

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
                {!hasImageInMetadata(initialData) && !preview && (
                    <Button
                        onClick={coverImage.onOpen}
                        className="text-muted-foreground text-xs"
                        variant="outline"
                        size="sm"
                    >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Add cover
                    </Button>
                )}
                {!preview && (
                    <Button
                        onClick={pageSettings.onOpen}
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