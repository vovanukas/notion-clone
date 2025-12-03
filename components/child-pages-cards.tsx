"use client";

import { useAppSidebar } from "@/hooks/use-app-sidebar";
import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { useMemo } from "react";
import { isIndexFile, PageNode } from "@/lib/tree-utils";

interface ChildPagesCardsProps {
    filePath: string;
}

// Get the link path for a child item
function getChildLink(documentId: string, node: PageNode): string {
    let path = node.contentPath || node.path;
    
    // Remove content/ prefix if present
    if (path.startsWith('content/')) {
        path = path.substring('content/'.length);
    }
    
    return `/documents/${documentId}/${path}`;
}

export function ChildPagesCards({ filePath }: ChildPagesCardsProps) {
    const params = useParams();
    const documentId = params.documentId as Id<"documents">;
    const { getPageByPath, pageTree } = useAppSidebar();

    const childPages = useMemo(() => {
        const pathParts = filePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        
        // 1. Check if we are on an index page.
        // If not, we are on a leaf page and should show nothing.
        if (!isIndexFile(fileName)) {
            return [];
        }
        
        // 2. Find the corresponding PageNode for this folder.
        // If we are at "content/_index.md" or "content/folder/_index.md",
        // the PageNode corresponds to the folder path "content" or "content/folder".
        
        const folderPath = pathParts.slice(0, -1).join('/');
        
        // Case: Root level (folderPath is empty string or just "content" depending on how we split)
        // If filePath is "content/_index.md", folderPath is "content"
        // If filePath is "_index.md" (rare?), folderPath is ""
        
        // In our pageTree, root nodes are at the top level of the array.
        // If folderPath is empty, we want the root nodes.
        
        if (!folderPath) {
             // This implies we are at the very root (if that's possible in this routing)
             // We return the top-level pageTree nodes (excluding Home Page itself)
             return pageTree.filter(node => node.title !== 'Home Page');
        }

        // Find the page node for this folder
        // Note: Our PageNode paths are full paths like "content/blog"
        // So we can lookup directly.
        const parentPage = getPageByPath(folderPath);
        
        if (!parentPage) {
            // Fallback: maybe we are at the root "content" folder?
            if (folderPath === 'content') {
                return pageTree.filter(node => node.title !== 'Home Page');
            }
            return [];
        }

        return parentPage.children || [];
    }, [filePath, getPageByPath, pageTree]);

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
                            {child.title}
                        </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
            ))}
        </div>
    );
}
