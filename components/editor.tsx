"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteEditor } from "@blocknote/core";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    CreateLinkButton,
    FileCaptionButton,
    FileReplaceButton,
    FormattingToolbar,
    FormattingToolbarController,
    useCreateBlockNote
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

import { useTheme } from "next-themes";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { useEffect, useCallback, useRef } from "react";

interface EditorProps {
    onChange: (value: string) => void;
    initialContent: string;
    editable?: boolean;
}

const generateUniqueFilename = (originalFilename: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = originalFilename.split('.').pop();
    const nameWithoutExtension = originalFilename.slice(0, originalFilename.lastIndexOf('.'));
    return `${nameWithoutExtension}-${timestamp}-${randomString}.${extension}`;
};

// 5MB file size limit
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

const Editor = ({onChange, initialContent, editable = true}: EditorProps) => {
    const { resolvedTheme } = useTheme();
    const params = useParams();
    const documentId = params.documentId as Id<"documents">;
    const uploadImage = useAction(api.github.uploadImage);
    const isInitialMount = useRef(true);

    const handleUpload = async (file: File) => {
        try {
            if (file.size > MAX_FILE_SIZE) {
                throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 5MB limit.`);
            }

            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.readAsDataURL(file);
            });

            const uniqueFilename = generateUniqueFilename(file.name);

            await uploadImage({
                id: documentId,
                file: base64,
                filename: uniqueFilename
            });

            return `https://raw.githubusercontent.com/hugity/${documentId}/refs/heads/main/static/images/${uniqueFilename}`;
        } catch (error) {
            console.error("Failed to upload image:", error);
            throw new Error(error instanceof Error ? error.message : "Failed to upload image. Please try again.");
        }
    }

    const editor: BlockNoteEditor = useCreateBlockNote({
        uploadFile: handleUpload
    });

    // Preprocess markdown to handle list and task list formatting issues
    const preprocessMarkdown = (markdown: string): string => {
        // Handle all combinations of bullet points and task lists
        // Using [*-] to match either * or - as list markers
        return markdown
            // First, normalize all list items to have single line breaks
            .replace(/(\n[*-] [^\n]+)\n\n([*-] )/g, '$1\n$2')
            // Then specifically handle task list items
            .replace(/(\n[*-] \[[x ]\][^\n]+)\n\n([*-] )/g, '$1\n$2')
            // Handle transition from bullet to task list
            .replace(/(\n[*-] [^\n]+)\n\n([*-] \[[x ]\])/g, '$1\n$2')
            // Handle transition from task list to bullet
            .replace(/(\n[*-] \[[x ]\][^\n]+)\n\n([*-] [^[])/g, '$1\n$2')
            // Normalize all list markers to - for consistency
            .replace(/\n\* /g, '\n- ');
    };

    useEffect(() => {
        if (isInitialMount.current && initialContent) {
            async function parseAndSetContent() {
                console.log('📝 Initial markdown:', initialContent);
                // Preprocess the markdown before parsing
                const processedMarkdown = preprocessMarkdown(initialContent);
                const blocks = await editor.tryParseMarkdownToBlocks(processedMarkdown);
                console.log('🔄 Parsed blocks:', blocks);
                editor.replaceBlocks(editor.document, blocks);
                const newBlocks = editor.document;
                console.log('📄 Editor blocks after replace:', newBlocks);
                isInitialMount.current = false;
            }
            parseAndSetContent();
        }
    }, [editor, initialContent]);

    const handleEditorChange = useCallback(async () => {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        // Apply preprocessing to maintain consistency
        const processedMarkdown = preprocessMarkdown(markdown);
        onChange(processedMarkdown);
    }, [editor, onChange]);

    return (
        <div>
            <BlockNoteView
                editor={editor}
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                editable={editable}
                onChange={handleEditorChange}
                formattingToolbar={false}
            >
                <FormattingToolbarController
                    formattingToolbar={() => (
                    <FormattingToolbar>
                        <BlockTypeSelect key={"blockTypeSelect"} />

                        <FileCaptionButton key={"fileCaptionButton"} />
                        <FileReplaceButton key={"replaceFileButton"} />

                        <BasicTextStyleButton
                        basicTextStyle={"bold"}
                        key={"boldStyleButton"}
                        />
                        <BasicTextStyleButton
                        basicTextStyle={"italic"}
                        key={"italicStyleButton"}
                        />
                        <BasicTextStyleButton
                        basicTextStyle={"strike"}
                        key={"strikeStyleButton"}
                        />

                        <CreateLinkButton key={"createLinkButton"} />
                    </FormattingToolbar>
                    )}
                />
            </BlockNoteView>
        </div>
    );
}

export default Editor;