"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";

import { useCoverImage } from "@/hooks/use-cover-image";
import { FilePond, registerPlugin } from "react-filepond";
import { FilePondFile, FilePondErrorDescription } from 'filepond';
import FilePondPluginFileEncode from 'filepond-plugin-file-encode';
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import 'filepond/dist/filepond.min.css';
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { findImageKey } from "@/lib/utils";


const generateUniqueFilename = (originalFilename: string): string => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = originalFilename.split('.').pop();
    const nameWithoutExtension = originalFilename.slice(0, originalFilename.lastIndexOf('.'));
    return `${nameWithoutExtension}-${timestamp}-${randomString}.${extension}`;
};

export const CoverImageModal = () => {
    registerPlugin(FilePondPluginFileEncode);
    const { documentId, filePath } = useParams();
    const router = useRouter();
    const [files, setFiles] = useState<File[]>([]);
    const [selectedFile, setSelectedFile] = useState<FilePondFile | null>(null);

    const coverImage = useCoverImage();
    const uploadImage = useAction(api.github.uploadImage);
    const saveContent = useAction(api.github.updateFileContent);
    const { updateFile, changedFiles, resetChangedFiles, getFileChanges } = useUnsavedChanges();

    const onClose = () => {
        setFiles([]);
        setSelectedFile(null);
        coverImage.onClose();
    };

    const onChange = async (error: FilePondErrorDescription | null, fileItem: FilePondFile) => {
        if (fileItem && !error) {
            setFiles([fileItem.file as File]);
            setSelectedFile(fileItem);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        onClose();

        const promise = (async () => {
            const uniqueFilename = generateUniqueFilename(selectedFile.filename);
            const res = await uploadImage({
                id: documentId as Id<"documents">,
                file: selectedFile.getFileEncodeBase64String(),
                filename: uniqueFilename
            });
            if (res && res.content && res.content.path) {
                const filePathString = Array.isArray(filePath) ? filePath.join('/') : filePath;
                const currentChanges = getFileChanges(filePathString as string);
                const imageKey = findImageKey(currentChanges) || 'image';
                const imagePath = res.content.path.replace('static/', '');
                updateFile(
                    filePathString as string,
                    {
                        [imageKey]: imagePath
                    }
                );

                // Save the changes
                await saveContent({
                    id: documentId as Id<"documents">,
                    filesToUpdate: changedFiles
                });
                resetChangedFiles();
                router.refresh();
            }
        })();

        toast.promise(promise, {
            loading: "Uploading image...",
            success: "Image uploaded successfully!",
            error: "Failed to upload image."
        });
    };

    return (
        <Dialog open={coverImage.isOpen} onOpenChange={coverImage.onClose}>
            <DialogContent>
                <DialogHeader>
                    <h3 className="text-center text-lg font-semibold">
                        Cover Image
                    </h3>
                </DialogHeader>
                <DialogTitle className="hidden"></DialogTitle>
                <FilePond
                    files={files}
                    allowMultiple={false}
                    allowReplace={true}
                    onaddfile={onChange}
                    acceptedFileTypes={['image/*']}
                    maxFiles={1}
                />
                <div className="flex justify-end mt-4">
                    <Button
                        onClick={handleUpload}
                        disabled={!selectedFile}
                    >
                        Upload
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};