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
import { Check, Copy, Globe } from "lucide-react";


interface PublishProps {
    initialData: Doc<"documents">
}

export const Publish = ({initialData}: PublishProps) => {
    const publishGithubPage = useAction(api.github.publishPage);

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
                    success: "We are launching your webiste!",
                    error: "Failed to launch."
                })
    }

    const onCopy = () => {
        navigator.clipboard.writeText(data?.websiteUrl);
        setCopied(true);

        setTimeout(() => {
            setCopied(false);
        }, 1000)
    };

    return (
        <div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button size="sm" variant="ghost">
                        Publish
                        {initialData.isPublished && (
                            <Globe 
                                className="text-sky-500 w-4 h-4 ml-2"
                            />
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end" alignOffset={8} forceMount>
                    {!initialData.workflowRunning ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-x-2">
                                <Globe className="text-sky-500 animate-pulse h-4 w-4" />
                                <p className="text-xs font-medium text-sky-500">
                                    This note is live on the web!
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
                                onClick={onPublish}
                            >
                                Push changes
                            </Button>
                        </div>
                    ) : (
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
                    )}

                </PopoverContent>
            </Popover>
        </div>
    )
}