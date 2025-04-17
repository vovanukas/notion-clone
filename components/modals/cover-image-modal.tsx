"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader
} from "@/components/ui/dialog";

import { useCoverImage } from "@/hooks/use-cover-image";
// import { SingleImageDropzone } from "@/components/single-image-dropzone";
import { FilePond, registerPlugin } from "react-filepond";
import { FilePondFile, FilePondErrorDescription } from 'filepond';
import FilePondPluginFileEncode from 'filepond-plugin-file-encode';
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import 'filepond/dist/filepond.min.css';
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";


export const CoverImageModal = () => {
    registerPlugin(FilePondPluginFileEncode);
    const { documentId, filePath } = useParams();
    const [files, setFiles] = useState<(string | Blob | File)[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const coverImage = useCoverImage();
    const uploadImage = useAction(api.github.uploadImage);
    const { updateFile } = useUnsavedChanges();

    const onClose = () => {
        setFiles([]);
        setIsSubmitting(false);
        coverImage.onClose();
    };

    const onChange = async (error: FilePondErrorDescription | null, fileItem: FilePondFile) => {
        if (fileItem && !error) {
            setIsSubmitting(true);
            console.log(fileItem);
            try {
                const res = await uploadImage({
                    id: documentId as Id<"documents">,
                    file: fileItem.getFileEncodeBase64String(),
                    filename: fileItem.filename
                });
                if (res && res.content && res.content.path) {
                    const filePathString = Array.isArray(filePath) ? filePath.join('/') : filePath;
                    updateFile(
                        filePathString as string,
                        {
                            featured_image: res.content.path
                        }
                    );
                }
                onClose();
                setIsSubmitting(false);
            } catch (error) {
                console.error("Failed to upload image:", error);
                setIsSubmitting(false);
            }
        }
    };

    return (
        <Dialog open={coverImage.isOpen} onOpenChange={coverImage.onClose}>
            <DialogContent>
                <DialogHeader>
                    <h3 className="text-center text-lg font-semibold">
                        Cover Image
                    </h3>
                </DialogHeader>
                {/* <SingleImageDropzone
                    className="w-full outline-none"
                    disabled={isSubmitting}
                    value={file}
                    onChange={onChange}
                /> */}
                <FilePond
                    files={files}
                    allowMultiple={false}
                    onaddfile={onChange}
                    disabled={isSubmitting}
                    acceptedFileTypes={['image/*']}
                    maxFiles={1}
                    labelIdle='Drag & drop your image or <span class="filepond--label-action">Browse</span>'
                />
            </DialogContent>
        </Dialog>
    );
};