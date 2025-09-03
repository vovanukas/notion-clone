"use client";

export const runtime = 'edge';

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsModal } from "@/components/modals/settings-modal";
import dynamic from "next/dynamic";
import { useEffect, useState, useMemo, useCallback, use } from "react";
import { useDocument } from "@/hooks/use-document";
import { useCreateBlockNote } from "@blocknote/react";
import { PartialBlock } from "@blocknote/core";
import Image from "next/image";
import { isImagePath } from "@/lib/utils";

interface FilePathPageProps {
    params: Promise<{
        documentId: Id<"documents">;
        filePath: [];
    }>;
}

// Helper function to find and validate image URLs
const findCoverImage = async (metadata: any, documentId: string) => {
    if (!metadata) return null;
    
    // Look through all metadata values for an image path
    for (const [, value] of Object.entries(metadata)) {
        if (typeof value === 'string' && isImagePath(value)) {
            // Try both paths
            const paths = [
                `https://raw.githubusercontent.com/hugity/${documentId}/refs/heads/main/static/${value}`,
                `https://raw.githubusercontent.com/hugity/${documentId}/refs/heads/main/assets/${value}`
            ];

            // Try each path
            for (const path of paths) {
                try {
                    const response = await fetch(path, { method: 'HEAD' });
                    if (response.ok) {
                        return path;
                    }
                } catch (error) {
                    console.log(`Failed to check path: ${path}`, error);
                }
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
        
        console.log('📄 Loading document:', decodedPath);
        useDocument.getState().debug();
        
        // Check if document is already loaded
        const existingDoc = getDocument(decodedPath);
        if (existingDoc) {
            console.log('📄 Document already loaded:', decodedPath);
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
            console.log('📄 Document loaded successfully:', decodedPath);
            useDocument.getState().debug();
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
        
        const imageValue = currentDocument.frontmatter.parsed[currentDocument.imageKey];
        if (!imageValue) {
            setCoverImageUrl(null);
            return;
        }

        // Only update URL if image exists
        findCoverImage(currentDocument.frontmatter.parsed, documentId).then(url => {
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
        JSON.stringify(currentDocument?.frontmatter.parsed)
    ]);

    const onChange = useCallback((markdown: string) => {
        updateMarkdown(decodedPath, markdown);
        console.log('📝 Document content updated:', decodedPath);
        useDocument.getState().debug();
    }, [updateMarkdown, decodedPath]);

    const onTitleChange = useCallback((value: string) => {
        if (!currentDocument) return;

        const newFrontmatter = {
            ...currentDocument.frontmatter.parsed,
            title: value
        };
        useDocument.getState().updateFrontmatterParsed(decodedPath, newFrontmatter);
        console.log('📑 Document title updated:', decodedPath);
        useDocument.getState().debug();
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

    if (document === null || currentDocument.error) {
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
                />
                <Editor 
                    onChange={onChange} 
                    initialContent={currentDocument.markdown} 
                    editable={true} 
                />
            </div>
            <SettingsModal />
        </div>
    );
};

export default FilePathPage;