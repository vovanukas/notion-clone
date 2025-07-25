"use client";

import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { Item } from "./item";
import { cn } from "@/lib/utils";
import { FileIcon } from "lucide-react";
import { useState } from "react";

interface DocumentListProps {
    parentDocumentId?: Id<"documents">;
    level?: number;
    data?: Doc<"documents">[];
}

export const DocumentList = ({
    level = 0
}: DocumentListProps) => {
    const params = useParams();
    const router = useRouter();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const fetchRepoTree = useAction(api.github.fetchRepoTree);

    const onExpand = (documentId: string) => {
        setExpanded(prevExpanded => ({
            ...prevExpanded,
            [documentId]: !prevExpanded[documentId]
        }));
    };


    const repoTree = fetchRepoTree({
        repoName: params.documentId as Id<"documents">
    });

    console.log(repoTree);

    const onRedirect = (documentId: string) => {
        router.push(`/documents/${documentId}`);
    };

    if (repoTree === undefined) {
        return (
            <>
                <Item.Skeleton level={level} />
                {level === 0 && (
                    <>
                        <Item.Skeleton level={level} />
                        <Item.Skeleton level={level} />
                    </>
                )}
            </>
        )
    }

    return (
        <>
            <p style={{
                paddingLeft: level ? `${level * 12 + 25}px` : undefined
            }}
            className={cn(
                "hiddent text-sm font-medium text-muted-foreground/80",
                expanded && "last:block",
                level === 0 && "hidden",
            )}
            >
                No pages inside
            </p>
            {documents.map((document) => (
                <div key={document._id}>
                    <Item 
                        id={document._id}
                        onClick={() => onRedirect(document._id)}
                        label={document.title}
                        icon={FileIcon}
                        documentIcon={document.icon}
                        active={params.documentId === document._id}
                        level={level}
                        onExpand={() => onExpand(document._id)}
                        expanded={expanded[document._id]}
                    />
                    {expanded[document._id] && (
                        <DocumentList 
                            parentDocumentId={document._id}
                            level={level + 1}
                        />
                    )}
                </div>
            ))}
        </>
    )
}