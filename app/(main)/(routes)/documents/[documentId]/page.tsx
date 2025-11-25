"use client";

export const runtime = 'edge';

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Cover } from "@/components/cover";
import { Skeleton } from "@/components/ui/skeleton";
import { use } from "react";
import Image from "next/image";
import { Loader } from "@/components/loader";

interface DocumentIdPageProps {
    params: Promise<{
        documentId: Id<"documents">;
    }>;
}

const DocumentIdPage = ({ params }: DocumentIdPageProps) => {
    const { documentId } = use(params);
    const document = useQuery(api.documents.getById, {
        documentId: documentId
    });

    if (document === undefined) {
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
                    We are having trouble loading your site. Please try again later.
                </p>
            </div>
        );
    }

    if (document.buildStatus === "BUILDING") {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
                <div className="flex flex-col items-center gap-2">
                    <div className="p-8 bg-secondary/10 rounded-full w-[120px] h-[120px] flex items-center justify-center">
                        <Loader size="default" variant="muted" />
                    </div>
                    <h2 className="text-2xl font-bold mt-4">Building Your Website</h2>
                    <p className="text-muted-foreground text-center">
                        Please wait while we create your beautiful website.<br />
                        This will only take a few seconds...
                    </p>
                </div>
            </div>
        );
    }

    if (document.buildStatus === "ERROR") {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Image
                    src="/error.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="dark:hidden"
                />
                <Image
                    src="/error-dark.png"
                    height="300"
                    width="300"
                    alt="Error"
                    className="hidden dark:block"
                />
                <h2 className="text-2xl font-bold">Build Failed</h2>
                <p className="text-muted-foreground text-lg text-center">
                    We encountered an error while building your website.<br />
                    Please contact support.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center space-y-6">
            <div className="flex flex-col items-center gap-4">
                <Image
                    src="/empty.png"
                    height="300"
                    width="300"
                    alt="Welcome"
                    className="dark:hidden"
                />
                <Image
                    src="/empty-dark.png"
                    height="300"
                    width="300"
                    alt="Welcome"
                    className="hidden dark:block"
                />
                <div className="text-center space-y-2 max-w-md">
                    <h2 className="text-2xl font-semibold">
                        Welcome to your documentation workspace
                    </h2>
                    <p className="text-muted-foreground text-lg">
                        Select a page to start editing
                    </p>
                </div>
            </div>
        </div>
    );
}

export default DocumentIdPage;
