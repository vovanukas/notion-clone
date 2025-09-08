"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
    PopoverTrigger,
    Popover,
    PopoverContent
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button";

import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Globe, AlertCircle } from "lucide-react";
import { Loader } from "@/components/loader";
import { Spinner } from "@/components/spinner";


interface PublishProps {
    initialData: Doc<"documents">
}

export const Publish = ({initialData}: PublishProps) => {
    const publishGithubPage = useAction(api.github.publishPage);
    const unpublishGithubPage = useAction(api.github.unpublishPage);

    const [copied, setCopied] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const data = useQuery(api.documents.getById, { documentId: initialData._id });

    const onPublish = async () => {
        setIsSubmitting(true);
        const promise = publishGithubPage({
            id: initialData._id,
        })
        .finally(() => setIsSubmitting(false));

        toast.promise(promise, {
                    loading: "Preparing to launch...",
                    success: "We are launching your website!",
                    error: "Failed to launch."
                })
    }

    const onUnpublish = async () => {
        setIsSubmitting(true);
        const promise = unpublishGithubPage({
            id: initialData._id,
        })
        .finally(() => setIsSubmitting(false));

        toast.promise(promise, {
                    loading: "Unpublishing website...",
                    success: "Website unpublished successfully!",
                    error: "Failed to unpublish."
                })
    }

    const onCopy = () => {
        navigator.clipboard.writeText(data?.websiteUrl);
        setCopied(true);

        setTimeout(() => {
            setCopied(false);
        }, 1000)
    };

    const renderPublishContent = () => {
        const publishStatus = data?.publishStatus;

        if (publishStatus === "PUBLISHING") {
            // If we have a URL, show it's updating an existing site
            if (data?.websiteUrl) {
                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-x-2">
                            <Spinner/>
                            <p className="text-xs font-medium">
                                Updating your website...
                            </p>
                        </div>
                        <div className="flex items-center">
                            <input
                                className="flex-1 px-2 text-xs border rounded-l-md h-8 bg-muted truncate"
                                value={data?.websiteUrl}
                                disabled
                            />
                            <Button
                                onClick={onCopy}
                                disabled={copied}
                                className="h-8 rounded-l-none"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <Button
                        size="sm"
                        className="w-full text-xs"
                        disabled={isSubmitting}
                        onClick={onUnpublish}
                        variant="destructive"
                        >
                            Unpublish
                        </Button>
                    </div>
                );
            }

            // Initial publish - no URL yet
            return (
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="h-12 w-12 flex items-center justify-center">
                        <Loader size="sm" variant="accent" />
                    </div>
                    <p className="text-sm font-medium text-center">
                        Publishing your website...
                    </p>
                    <p className="text-xs text-muted-foreground text-center">
                        This may take a few minutes
                    </p>
                </div>
            );
        }

        if (publishStatus === "PUBLISHED") {
            return (
                <div className="space-y-4">
                    <div className="flex items-center gap-x-2">
                        <Globe className="text-sky-500 animate-pulse h-4 w-4" />
                        <p className="text-xs font-medium text-sky-500">
                            This website is live on the web!
                        </p>
                    </div>
                    <div className="flex items-center">
                        <input
                            className="flex-1 px-2 text-xs border rounded-l-md h-8 bg-muted truncate"
                            value={data?.websiteUrl}
                            disabled
                        />
                        <Button
                            onClick={onCopy}
                            disabled={copied}
                            className="h-8 rounded-l-none"
                        >
                            {copied ? (
                                <Check className="h-4 w-4" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <Button
                        size="sm"
                        className="w-full text-xs"
                        disabled={isSubmitting}
                        onClick={onUnpublish}
                        variant="destructive"
                    >
                        Unpublish
                    </Button>
                </div>
            );
        }

        if (publishStatus === "ERROR") {
            return (
                <div className="space-y-4">
                    <div className="flex items-center gap-x-2">
                        <AlertCircle className="text-red-500 h-4 w-4" />
                        <p className="text-xs font-medium text-red-500">
                            Publishing failed
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        There was an error publishing your website. Please try again.
                    </p>
                    <Button
                        size="sm"
                        className="w-full text-xs"
                        disabled={isSubmitting}
                        onClick={onPublish}
                    >
                        Try again
                    </Button>
                </div>
            );
        }

        // UNPUBLISHED or undefined
        return (
            <div className="flex flex-col items-center justify-center">
                <Globe className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium mb-2">
                    Publish this website
                </p>
                <span className="text-xs text-muted-foreground mb-4">
                    Share your work with others!
                </span>
                <Button
                    disabled={isSubmitting}
                    onClick={onPublish}
                    className="w-full text-xs"
                    size="sm"
                >
                    Publish
                </Button>
            </div>
        );
    };

    return (
        <div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button size="sm" variant="ghost">
                        {data?.publishStatus === "PUBLISHING" ? "Publishing..." : "Publish"}
                        {data?.publishStatus === "PUBLISHED" && (
                            <Globe 
                                className="text-sky-500 w-4 h-4 ml-2"
                            />
                        )}
                        {data?.publishStatus === "PUBLISHING" && (
                            <Spinner size="sm" />
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end" alignOffset={8} forceMount>
                    {renderPublishContent()}
                </PopoverContent>
            </Popover>
        </div>
    )
}