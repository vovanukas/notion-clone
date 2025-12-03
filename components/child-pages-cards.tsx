"use client";

import { useAppSidebar } from "@/hooks/use-app-sidebar";
import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";

interface ChildPagesCardsProps {
    filePath: string;
}

// Check if a file is an index file (Hugo branch or leaf bundle)
function isIndexFile(fileName: string): boolean {
    return fileName === '_index.md' || fileName === 'index.md';
}

// Convert file/folder name to a readable title
function formatTitle(name: string): string {
    return name
        .replace(/\.md$/, '')           // Remove .md extension
        .replace(/^_?index$/, '')       // Remove _index or index
        .replace(/[-_]/g, ' ')          // Replace hyphens/underscores with spaces
        .replace(/\b\w/g, c => c.toUpperCase()) // Title case
        .trim();
}

// Get the display name for a child item
function getDisplayName(node: { name: string; path: string; type: string }): string {
    // For both folders and files, use the name
    return formatTitle(node.name);
}

// Get the link path for a child item
function getChildLink(documentId: string, node: { name: string; path: string; type: string; children?: any[] }): string {
    if (node.type === 'tree') {
        // For folders, link to _index.md (or index.md if that's what exists)
        const indexChild = node.children?.find(c => isIndexFile(c.name));
        const indexFileName = indexChild?.name || '_index.md';
        return `/documents/${documentId}/${node.path}/${indexFileName}`;
    }
    // For files, link directly
    return `/documents/${documentId}/${node.path}`;
}

export function ChildPagesCards({ filePath }: ChildPagesCardsProps) {
    const params = useParams();
    const documentId = params.documentId as Id<"documents">;
    const { getNodeByPath, treeData } = useAppSidebar();

    const childPages = useMemo(() => {
        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        
        // Check if we're on an index page (branch or leaf bundle)
        const isOnIndexPage = isIndexFile(fileName);
        
        if (!isOnIndexPage) {
            // Regular .md files don't have children in Notion-like model
            // They're leaf pages, not containers
            return [];
        }
        
        // We're on an index page - get the folder's children
        const parentPath = pathParts.slice(0, -1).join('/');

        // If we're at the root level (_index.md at root), use treeData directly
        if (!parentPath) {
            return treeData.filter(node => {
                // Exclude current file and other index files at root
                if (node.path === filePath || isIndexFile(node.name)) return false;
                // Include folders (they're pages in Notion-like model)
                if (node.type === 'tree') return true;
                // Include .md files
                if (node.type === 'blob' && node.name.endsWith('.md')) return true;
                return false;
            });
        }

        // Get the parent node (the folder we're inside)
        const parentNode = getNodeByPath(parentPath);
        if (!parentNode || !parentNode.children) {
            return [];
        }

        // Filter children to show - exclude index files, include everything else
        return parentNode.children.filter(node => {
            // Exclude index files (that's the current page)
            if (isIndexFile(node.name)) return false;
            // Include folders (even if they only have _index.md - they're still pages)
            if (node.type === 'tree') return true;
            // Include other .md files
            if (node.type === 'blob' && node.name.endsWith('.md')) return true;
            return false;
        });
    }, [filePath, getNodeByPath, treeData]);

    // Don't render if no children
    if (childPages.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 space-y-3 pl-[54px] pr-[54px]">
            {childPages.map((child) => (
                <Link
                    key={child.path}
                    href={getChildLink(documentId, child)}
                    className="group flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all duration-200"
                >
                    <div className="flex items-center gap-3">
                        {/* All items are "pages" in Notion-like model - use consistent icon */}
                        <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {getDisplayName(child)}
                        </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
            ))}
        </div>
    );
}

