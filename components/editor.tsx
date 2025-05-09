"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteEditor } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

import { useTheme } from "next-themes";
import { useEdgeStore } from "@/lib/edgestore";
import { useEffect, useCallback, useRef } from "react";

interface EditorProps {
    onChange: (value: string) => void;
    initialContent: string;
    editable?: boolean;
}

const Editor = ({onChange, initialContent, editable = true}: EditorProps) => {
    const { resolvedTheme } = useTheme();
    const { edgestore } = useEdgeStore();
    const isInitialMount = useRef(true);

    const handleUpload = async (file: File) => {
        const response = await edgestore.publicFiles.upload({
            file
        });

        return response.url;
    }

    const editor: BlockNoteEditor = useCreateBlockNote({
        uploadFile: handleUpload
    });

    useEffect(() => {
        if (isInitialMount.current && initialContent) {
            async function parseAndSetContent() {
                const blocks = await editor.tryParseMarkdownToBlocks(initialContent);
                editor.replaceBlocks(editor.document, blocks);
                isInitialMount.current = false;
            }
            parseAndSetContent();
        }
    }, [editor, initialContent]);

    const handleEditorChange = useCallback(() => {
        const currentContent = JSON.stringify(editor.document, null, 2);
        onChange(currentContent);
    }, [editor, onChange]);

    return (
        <div>
            <BlockNoteView
                editor={editor}
                theme={resolvedTheme === "dark" ? "dark" : "light"}
                editable={editable}
                onChange={handleEditorChange}
            />
        </div>
    );
}

export default Editor;