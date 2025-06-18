"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPicker } from "@/components/icon-picker";
import { SmilePlus } from "lucide-react";

interface TitleProps {
    initialData: Doc<"documents">;
};

export const Title = ({
    initialData
}: TitleProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const update = useMutation(api.documents.update);

    const [title, setTitle] = useState(initialData.title || "Untitled");
    const [isEditing, setIsEditing] = useState(false);

    const enableInput = () => {
        setTitle(initialData.title);
        setIsEditing(true);
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(0, inputRef.current.value.length);
        }, 0);
    };

    const disableInput = () => {
        setIsEditing(false);
    };

    const onChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        setTitle(event.target.value);
        update({
            id: initialData._id,
            title: event.target.value || "Untitled",
        });
    };

    const onKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (event.key === "Enter") {
            disableInput();
        }
    };

    const handleIconChange = (icon: string) => {
        update({
            id: initialData._id,
            icon,
        });
    };

    const handleIconRemove = () => {
        update({
            id: initialData._id,
            icon: ""
        });
    };

    return (
        <div className="flex items-center gap-x-2">
            <IconPicker onChange={handleIconChange} onRemove={handleIconRemove}>
                <span className="cursor-pointer">
                    {initialData.icon ? initialData.icon : <SmilePlus className="h-4 w-4 text-muted-foreground" />}
                </span>
            </IconPicker>
            {isEditing ? (
                <Input
                    className="h-7 px-2 focus-visible:ring-transparent"
                    ref={inputRef}
                    value={title}
                    onClick={enableInput}
                    onBlur={disableInput}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                />
            ) : (
                <Button
                    onClick={enableInput}
                    variant="ghost"
                    size="sm"
                    className="font-normal h-auto p-1"
                >
                    <span className="truncate">
                        {title}
                    </span>
                </Button>
            )}
        </div>
    )
}

Title.Skeleton = function TitleSkeleton() {
    return (
        <div className="flex items-center gap-x-2">
            <Skeleton className="h-6 w-6 rounded-md"/>
            <Skeleton className="h-6 w-20 rounded-md"/>
        </div>
    )
}