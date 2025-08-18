"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/toolbar";
import { Cover } from "@/components/cover";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsModal } from "@/components/modals/settings-modal";
import dynamic from "next/dynamic";
import { useEffect, useState, useMemo, useCallback, use } from "react";
import matter from "gray-matter";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAppSidebar } from "@/hooks/use-app-sidebar";
import { useCreateBlockNote } from "@blocknote/react";
import { PartialBlock } from "@blocknote/core";
import Image from "next/image";

interface FilePathPageProps {
    params: Promise<{
        documentId: Id<"documents">;
        filePath: [];
    }>;
}

const FilePathPage = ({ params }: FilePathPageProps) => {
    const { documentId, filePath } = use(params);
    const filePathString = Array.isArray(filePath) ? filePath.join('/') : filePath;
    const fetchFileContent = useAction(api.github.fetchAndReturnGithubFileContent);

    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<{ [key: string]: any } | null>(null);
    const [previousDocumentId, setPreviousDocumentId] = useState<string | null>(null);

    const { updateFile, resetChangedFiles, getFileChanges } = useUnsavedChanges();
    const { getNodeByPath } = useAppSidebar();
    const currentFileNode = useMemo(() => getNodeByPath(filePathString), [filePathString, getNodeByPath]);

    const document = useQuery(api.documents.getById, useMemo(() => ({
        documentId: documentId,
    }), [documentId]));

    const Editor = useMemo(() => dynamic(() => import("@/components/editor"), { ssr: false }), []);
    const editor = useCreateBlockNote();

    // Reset unsaved changes only when switching between different websites (different documentIds)
    useEffect(() => {
        if (previousDocumentId && previousDocumentId !== documentId) {
            resetChangedFiles();
        }
        setPreviousDocumentId(documentId);
    }, [documentId, resetChangedFiles, previousDocumentId]);

    useEffect(() => {
        if (!loading && metadata) {
            updateFile(filePathString, {
                content,
                ...metadata,
                sha: currentFileNode?.sha
            });
        }
    }, [content, metadata, currentFileNode?.sha, updateFile, filePathString, loading]);

    const loadContent = useCallback(async () => {
        if (!documentId || !filePath) return;
        
        const filePathString = Array.isArray(filePath) ? filePath.join('/') : filePath;
        const decodedPath = decodeURIComponent(filePathString);
        
        // Check if there are existing unsaved changes for this file
        const existingChanges = getFileChanges(decodedPath);
        
        if (existingChanges) {
            // Use existing unsaved changes
            setContent(existingChanges.content || "");
            setMetadata(existingChanges as { [key: string]: any });
            setLoading(false);
            return;
        }
        
        // No existing changes, load from server
        try {
            const fileContent = await fetchFileContent({
                id: documentId,
                path: `content/${decodedPath}`,
            });
            const { data, content: actualContent } = matter(fileContent);
            setContent(actualContent.trim());
            setMetadata(data as { [key: string]: any });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [documentId, filePath, fetchFileContent, getFileChanges]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);

    const onChange = useCallback(async (content: string) => {
        const blocks: PartialBlock[] = JSON.parse(content);
        const markdown = await editor.blocksToMarkdownLossy(blocks);
        setContent(markdown);
    }, [editor]);

    const onTitleChange = useCallback((value: string) => {
        const newTitle = value;
        setMetadata(prev => ({ ...prev, title: newTitle }));
    }, []);

    if (document === undefined || loading) {
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

    if (document === null || error) {
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

    const coverImageUrl = `https://raw.githubusercontent.com/hugotion/${documentId}/refs/heads/main/static/${metadata?.featured_image}`;

    return (
        <div className="pb-40">
            {metadata?.featured_image && <Cover url={coverImageUrl} />}
            <div className="md:max-w-3xl lg:max-w-4xl mx-auto">
                <Toolbar
                    onTitleChange={onTitleChange}
                    initialData={{ ...document, ...metadata }}
                    showIconPicker={false}
                />
                <Editor onChange={onChange} initialContent={content} editable={true} />
            </div>
            <SettingsModal />
        </div>
    );
};

export default FilePathPage;