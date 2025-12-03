"use client";

export const runtime = "edge";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { useEffect, useState, useMemo, useCallback, use } from "react";
import { useDocument } from "@/hooks/use-document";
import Image from "next/image";
import { isImagePath, getNestedValue } from "@/lib/utils";
import { ChildPagesCards } from "@/components/child-pages-cards";

interface FilePathPageProps {
    params: Promise<{
        documentId: Id<"documents">;
        filePath: [];
    }>;
}

// Helper function to find and validate image URLs
const findCoverImage = async (metadata: any, documentId: string, theme?: string) => {
    if (!metadata) return null;
    
    // Helper function to recursively search for image paths
    const findImagePaths = (obj: any): string[] => {
        const paths: string[] = [];

        for (const [, value] of Object.entries(obj)) {
            if (typeof value === 'string' && isImagePath(value)) {
                paths.push(value);
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                paths.push(...findImagePaths(value));
            }
        }

        return paths;
    };

    const imagePaths = findImagePaths(metadata);

    // Try each image path found
    for (const imagePath of imagePaths) {
        // Build possible paths array
        const paths = [
            `https://raw.githubusercontent.com/hugity/${documentId}/refs/heads/main/static/${imagePath}`,
            `https://raw.githubusercontent.com/hugity/${documentId}/refs/heads/main/assets/${imagePath}`
        ];

        // Add theme-specific paths if theme is available
        if (theme) {
            paths.push(
                `https://raw.githubusercontent.com/hugity/${documentId}/refs/heads/main/themes/${theme}/static/${imagePath}`,
                `https://raw.githubusercontent.com/hugity/${documentId}/refs/heads/main/themes/${theme}/static/images/${imagePath}`
            );
        }

        // Try each path
        for (const path of paths) {
            try {
                const response = await fetch(path, { method: 'HEAD' });
                if (response.ok) {
                    return path;
                }
            } catch {
                // Ignore errors checking path
            }
        }
    }
    return null;
};

const FilePathPage = ({ params }: FilePathPageProps) => {
    const { documentId, filePath } = use(params);
    const filePathString = Array.isArray(filePath) ? filePath.join('/') : filePath;
    const decodedPath = decodeURIComponent(filePathString);
    const fetchFileContent = useAction(api.github.fetchAndReturnGithubFileContent);

    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const document = useQuery(api.documents.getById, useMemo(() => ({
        documentId: documentId,
    }), [documentId]));

    const Editor = useMemo(() => dynamic(() => import("@/components/editor"), { ssr: false }), []);

    // Get document from our store
    const { loadDocument, getDocument, updateMarkdown } = useDocument();
    const currentDocument = useDocument(state => state.documents.get(decodedPath));

    const loadContent = useCallback(async () => {
        if (!documentId || !filePath) return;
        
        // Check if document is already loaded
        const existingDoc = getDocument(decodedPath);
        if (existingDoc) {
            setLoading(false);
            return;
        }
        
        // Load from server
        try {
            const fileContent = await fetchFileContent({
                id: documentId,
                path: `content/${decodedPath}`,
            });

            // Load into document store
            loadDocument(documentId, decodedPath, fileContent);
        } catch (err) {
            console.error("Failed to load document:", err);
        } finally {
            setLoading(false);
        }
    }, [documentId, filePath, decodedPath, fetchFileContent, loadDocument, getDocument]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);

    // Update cover image URL when image field changes
    useEffect(() => {
        // Clear cover image if no valid image data
        if (!currentDocument?.frontmatter.parsed || !documentId || !currentDocument.imageKey) {
            setCoverImageUrl(null);
            return;
        }

        const imageValue = getNestedValue(currentDocument.frontmatter.parsed, currentDocument.imageKey);
        if (!imageValue) {
            setCoverImageUrl(null);
            return;
        }

        // Only update URL if image exists
        findCoverImage(currentDocument.frontmatter.parsed, documentId, document?.theme).then(url => {
            if (url !== coverImageUrl) {
                setCoverImageUrl(url);
            }
        });
    }, [
        documentId,
        coverImageUrl,
        // Watch for both the presence of imageKey and the entire frontmatter
        // This ensures we update when keys are removed
        currentDocument?.imageKey,
        currentDocument?.frontmatter.parsed,
        document?.theme
    ]);

    const onChange = useCallback((markdown: string) => {
        updateMarkdown(decodedPath, markdown);
    }, [updateMarkdown, decodedPath]);

    const onTitleChange = useCallback((value: string) => {
        if (!currentDocument) return;

        const newFrontmatter = {
            ...currentDocument.frontmatter.parsed,
            title: value
        };
        useDocument.getState().updateFrontmatterParsed(decodedPath, newFrontmatter);
    }, [currentDocument, decodedPath]);

    if (document === undefined || loading || !currentDocument) {
        return (
            <div>
                <Cover.Skeleton />
                <div className="md:max-w-3xl lg:max-w-4xl mx-auto mt-10">
                    <div className="space-y-4 pl-8 pt-4">
                        <Skeleton className="h-14 w-[50%]" />
                        <Skeleton className="h-4 w-[80%]" />
                        <Skeleton className="h-4 w-[40%]" />
                        <Skeleton className="h-4 w-[60%]" />
                    </div>
                </div>
            </div>
        );
    }

    if (document === null) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Image
                    src="/documents.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="dark:hidden"
                />
                <Image
                    src="/documents-dark.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="hidden dark:block"
                />
                <p className="text-muted-foreground text-lg">
                    We are having trouble loading this page. Please try again later.
                </p>
            </div>
        );
    }

    return (
        <div className="pb-40">
            {coverImageUrl && <Cover url={coverImageUrl} />}
            <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
                <Toolbar
                    onTitleChange={onTitleChange}
                    initialData={{
                        _id: document._id,
                        icon: document.icon,
                        // Only include title if it exists in frontmatter
                        ...(currentDocument.frontmatter.parsed.title && {
                            title: currentDocument.frontmatter.parsed.title
                        }),
                        ...currentDocument.frontmatter.parsed
                    }}
                    showIconPicker={false}
                    filePath={filePathString}
                />
                <Editor
                    key={decodedPath}
                    onChange={onChange}
                    initialContent={currentDocument.markdown}
                    editable={true}
                />
                <ChildPagesCards filePath={decodedPath} />
            </div>
        </div>
    );
};

export default FilePathPage;