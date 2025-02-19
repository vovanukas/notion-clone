"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";

import { useUser } from "@clerk/clerk-react";
import { PlusCircleIcon } from "lucide-react";
import { useAction, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

const DocumentsPage = () => {
    const { user } = useUser();
    const create = useMutation(api.documents.create);
    const createRepo = useAction(api.github.createRepo);
    const router = useRouter();

    const onCreate = () => {
        const promise = create({ title: "Untitled" })
            .then((documentId) => {
                router.push(`documents/${documentId}`);
                return createRepo({
                    repoName: documentId
                });
            })

        toast.promise(promise, {
            loading: "Creating a new note...",
            success: "New note created!",
            error: "Failed to create a new note.",
        })
    }

    return ( 
        <div className="h-full flex flex-col items-center justify-center space-y-4">
            <Image
                src="/empty.png"
                height="300"
                width="300"
                alt="Empty"
                className="dark:hidden"
            />
            <Image
                src="/empty-dark.png"
                height="300"
                width="300"
                alt="Empty"
                className="hidden dark:block"
            />
            <h2 className="text-lg font-medium">
                Welcome to { user?.firstName } &apos;s Jotion!
            </h2>
            <Button onClick={onCreate}>
                <PlusCircleIcon className="h-4 w-4 mr-2" />
                Create a note
            </Button>
        </div>
     );
}
 
export default DocumentsPage;