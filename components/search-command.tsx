"use client";

import { useEffect, useState, useMemo } from "react";
import { File } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/clerk-react";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { useSearch } from "@/hooks/use-search"; 
import { useAppSidebar } from "@/hooks/use-app-sidebar";
import { HugoFileNode } from "@/types/hugo";

export const SearchCommand = () => {
    const { user } = useUser();
    const router = useRouter();
    const params = useParams();
    const { treeData } = useAppSidebar();
    const [isMounted, setIsMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const toggle = useSearch((store) => store.toggle);
    const isOpen = useSearch((store) => store.isOpen);
    const onClose = useSearch((store) => store.onClose);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey  || e.ctrlKey)) {
                e.preventDefault();
                toggle();
            }
        }

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [toggle]);

    // Recursively flatten the tree to get all files
    const flattenTree = (nodes: HugoFileNode[]): HugoFileNode[] => {
        const result: HugoFileNode[] = [];

        const traverse = (node: HugoFileNode) => {
            result.push(node);
            if (node.children) {
                node.children.forEach(traverse);
            }
        };

        nodes.forEach(traverse);
        return result;
    };

    // Filter files based on search query
    const filteredFiles = useMemo(() => {
        if (!treeData.length) return [];

        const allFiles = flattenTree(treeData);

        // If no search query, show all files
        if (!searchQuery.trim()) {
            return allFiles.filter(file => file.type === 'blob').slice(0, 20); // Limit to 20 results
        }

        const query = searchQuery.toLowerCase();

        return allFiles.filter(file => {
            // Only show files (blob type), not folders
            if (file.type !== 'blob') return false;

            // Filter by file name (without extension)
            const fileName = file.name.toLowerCase();
            const nameWithoutExt = fileName.replace(/\.(md|markdown)$/, '');

            return fileName.includes(query) || nameWithoutExt.includes(query);
        }).slice(0, 10); // Limit to 10 results
    }, [treeData, searchQuery]);

    // Helper function to get display path
    const getDisplayPath = (filePath: string): string => {
        // Remove 'content/' prefix if it exists
        let path = filePath;
        if (path.startsWith('content/')) {
            path = path.substring('content/'.length);
        }

        // Get the directory path (everything except the filename)
        const pathParts = path.split('/');
        if (pathParts.length <= 1) {
            return ''; // File is in root
        }

        // Return the directory path
        return pathParts.slice(0, -1).join('/');
    };

    const onSelect = (filePath: string) => {
        if (!params.documentId) return;

        // Remove 'content/' prefix if it exists
        let navigationPath = filePath;
        if (navigationPath.startsWith('content/')) {
            navigationPath = navigationPath.substring('content/'.length);
        }

        router.push(`/documents/${params.documentId}/${navigationPath}`);
        onClose();
    };

    if(!isMounted) {
        return null
    }

    return (
        <CommandDialog open={isOpen} onOpenChange={onClose}>
            <CommandInput
                placeholder={`Search files in ${user?.fullName}'s site...`}
                value={searchQuery}
                onValueChange={setSearchQuery}
            />
            <CommandList>
                <CommandEmpty>No files found...</CommandEmpty>
                <CommandGroup heading="Files">
                    {filteredFiles.map((file) => {
                        const displayPath = getDisplayPath(file.path);
                        return (
                            <CommandItem
                                key={file.path}
                                value={`${file.path}-${file.name}`}
                                title={file.name}
                                onSelect={() => onSelect(file.path)}
                            >
                                <File className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                    <span className="font-medium">{file.name}</span>
                                    {displayPath && (
                                        <span className="text-xs text-muted-foreground">
                                            {displayPath}
                                        </span>
                                    )}
                                </div>
                            </CommandItem>
                        );
                    })}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}