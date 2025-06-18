"use client";

import EmojiPicker, { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";

import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover"

interface IconPickerProps {
    onChange: (icon: string) => void;
    children: React.ReactNode;
    asChild?: boolean;
    onRemove?: () => void;
};

export const IconPicker = ({
    onChange,
    children,
    asChild,
    onRemove
}: IconPickerProps) => {
    const { resolvedTheme } = useTheme();
    const currentTheme = (resolvedTheme || "light") as keyof typeof themeMap

    const themeMap = {
        "dark": Theme.DARK,
        "light": Theme.LIGHT,
    }

    const theme = themeMap[currentTheme];

    return (
        <Popover>
            <PopoverTrigger asChild={asChild}>
                {children}
            </PopoverTrigger>
            <PopoverContent className="p-0 w-full border-none shadow-none">
                {onRemove && (
                    <Button
                        onClick={onRemove}
                        className="w-full justify-start text-xs rounded-none p-2 text-muted-foreground"
                        variant="ghost"
                        size="sm"
                    >
                        Remove Icon
                    </Button>
                )}
                <EmojiPicker 
                    height={350}
                    theme={theme}
                    onEmojiClick={(data) => onChange(data.emoji)}
                />
            </PopoverContent>
        </Popover>
    );
};