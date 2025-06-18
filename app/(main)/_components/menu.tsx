"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/clerk-react";
import { useMutation, useAction } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash, UploadCloudIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MenuProps {
    documentId: Id<"documents">;
}

export const Menu = ({
    documentId,
}: MenuProps) => {
    const router = useRouter();
    const { user } = useUser();

    const remove = useMutation(api.documents.remove);
    const deleteRepo = useAction(api.github.deleteRepo);

    const onDeleteSitePermanently = async () => {
        router.push("/documents");
        const promise = Promise.all([
            deleteRepo({ id: documentId }),
            remove({ id: documentId })
        ]);
        toast.promise(promise, {
            loading: "Deleting site...",
            success: "Site deleted permanently!",
            error: "Failed to delete site."
        });
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end" alignOffset={8} forceMount>
                <DropdownMenuItem onClick={onDeleteSitePermanently} className="text-destructive focus:text-red-600">
                    <Trash className="h-4 w-4 mr-2" />
                    Delete Site Permanently
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="text-xs text-muted-foreground p-2">
                    Last edited by: {user?.fullName}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

Menu.Skeleton = function MenuSkeleton() {
    return (
        <Skeleton className="h-10 w-10" />
    )
}