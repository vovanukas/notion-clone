"use client";

import { useState, useEffect } from "react";
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
import { useDocument } from "@/hooks/use-document";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { setNestedValue, findBestImageKey } from "@/lib/utils";

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
    const { updateFrontmatterParsed } = useDocument();
    const currentDocument = useDocument(state => state.documents.get(Array.isArray(filePath) ? filePath.join('/') : filePath as string));

    const onClose = () => {
        setFiles([]);
        setSelectedFile(null);
        coverImage.onClose();
    };

    const onChange = async (error: FilePondErrorDescription | null, fileItem: FilePondFile) => {
        if (error) {
            console.error('FilePond error:', error);
            return;
        }

        if (fileItem && fileItem.file) {
            // Validate file type
            const file = fileItem.file as File;
            if (!file.type.startsWith('image/')) {
                console.error('Invalid file type:', file.type);
                return;
            }

            setFiles([file]);
            setSelectedFile(fileItem);
        }
    };

    const onUpdateFiles = (fileItems: FilePondFile[]) => {
        if (fileItems.length === 0) {
            setFiles([]);
            setSelectedFile(null);
        } else if (fileItems.length > 0) {
            const fileItem = fileItems[0];
            if (fileItem.file) {
                setFiles([fileItem.file as File]);
                setSelectedFile(fileItem);
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        onClose();

        // Capture these values before the async operation for toast messaging
        let imageKeyForToast: string = 'image';
        let isExistingKeyForToast: boolean = false;
        const hasExistingImageKey = !!currentDocument?.imageKey;

        const promise = (async () => {
            const uniqueFilename = generateUniqueFilename(selectedFile.filename);
            const uploadOk = await uploadImage({
                id: documentId as Id<"documents">,
                file: selectedFile.getFileEncodeBase64String(),
                filename: uniqueFilename
            });
            if (uploadOk) {
                const filePathString = Array.isArray(filePath) ? filePath.join('/') : filePath;
                if (currentDocument) {
                    // Uploaded to static/images/<uniqueFilename>; strip "static/" for frontmatter
                    const imagePath = `images/${uniqueFilename}`;

                    // Smart key detection: use existing image key or find the best one
                    let imageKey: string;
                    let isExistingKey: boolean;

                    if (currentDocument.imageKey) {
                        // Use the existing image key (replacement scenario)
                        imageKey = currentDocument.imageKey;
                        isExistingKey = true;
                    } else {
                        // Find the best image key to use (new image scenario)
                        const bestKey = findBestImageKey(currentDocument.frontmatter.parsed);
                        imageKey = bestKey.key;
                        isExistingKey = bestKey.isExisting;
                    }

                    // Store for toast messaging
                    imageKeyForToast = imageKey;
                    isExistingKeyForToast = isExistingKey;

                    const newFrontmatter = setNestedValue(
                        currentDocument.frontmatter.parsed,
                        imageKey,
                        imagePath
                    );
                    
                    updateFrontmatterParsed(filePathString as string, newFrontmatter);

                    // Save the changes
                    const fileForGithub = useDocument.getState().prepareForGithub(filePathString as string);
                    if (fileForGithub) {
                        await saveContent({
                            id: documentId as Id<"documents">,
                            filesToUpdate: [{
                                path: fileForGithub.path,
                                content: fileForGithub.content
                            }]
                        });
                    }
                }
                router.refresh();
            }
        })();

        toast.promise(promise, {
            loading: "Uploading image and publishing changes...",
            success: () => {
                // Determine success message based on key type
                if (hasExistingImageKey) {
                    return "Cover image updated! Your site is being published.";
                } else if (isExistingKeyForToast) {
                    return `Cover image added to existing '${imageKeyForToast}' field! Your site is being published.`;
                } else {
                    return `Cover image added as '${imageKeyForToast}' field! Check your theme documentation if it doesn't appear.`;
                }
            },
            error: "Failed to upload image."
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Prevent drag events on the entire document when modal is open
    useEffect(() => {
        if (!coverImage.isOpen) return;

        const preventDragEvents = (e: DragEvent) => {
            const target = e.target as Element;

            // Allow drag events only within FilePond components
            const isFilePondElement = target.closest('.filepond--root') ||
                                     target.closest('.filepond--drop-label') ||
                                     target.closest('.filepond--panel-root') ||
                                     target.closest('[data-modal="cover-image"]');

            if (!isFilePondElement) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        };

        // Use capture phase to catch events early
        document.addEventListener('dragover', preventDragEvents, true);
        document.addEventListener('drop', preventDragEvents, true);
        document.addEventListener('dragenter', preventDragEvents, true);
        document.addEventListener('dragleave', preventDragEvents, true);

        return () => {
            document.removeEventListener('dragover', preventDragEvents, true);
            document.removeEventListener('drop', preventDragEvents, true);
            document.removeEventListener('dragenter', preventDragEvents, true);
            document.removeEventListener('dragleave', preventDragEvents, true);
        };
    }, [coverImage.isOpen]);

    return (
        <Dialog open={coverImage.isOpen} onOpenChange={coverImage.onClose}>
            <DialogContent
                data-modal="cover-image"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                className="pointer-events-auto"
            >
                <DialogHeader>
                    <h3 className="text-center text-lg font-semibold">
                        Cover Image
                    </h3>
                </DialogHeader>
                <DialogTitle className="hidden"></DialogTitle>
                <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                >
                    <FilePond
                        files={files}
                        allowMultiple={false}
                        allowReplace={true}
                        onupdatefiles={onUpdateFiles}
                        onaddfile={onChange}
                        onremovefile={() => {
                            setFiles([]);
                            setSelectedFile(null);
                        }}
                        acceptedFileTypes={['image/*']}
                        maxFiles={1}
                        dropOnPage={false}
                        dropOnElement={true}
                        allowDrop={true}
                        allowBrowse={true}
                        allowPaste={false}
                        checkValidity={true}
                        labelIdle='Drag & Drop your image or <span class="filepond--label-action">Browse</span>'
                    />
                </div>
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