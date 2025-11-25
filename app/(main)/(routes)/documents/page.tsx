"use client";

export const runtime = "edge";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/clerk-react";
import { PlusCircleIcon } from "lucide-react";
import { useThemeSelector } from "@/hooks/use-theme-selector";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useEffect } from "react";

const DocumentsPage = () => {
    const { user } = useUser();
    const themeSelector = useThemeSelector();
    const onboarding = useOnboarding();

    // Check if user needs onboarding
    useEffect(() => {
        if (user && !user.publicMetadata?.onboardingComplete) {
            // Small delay to ensure UI is ready
            const timer = setTimeout(() => {
                onboarding.onOpen();
            }, 1000);
            
            return () => clearTimeout(timer);
        }
    }, [user, onboarding]);

    const onCreate = () => {
        themeSelector.onOpen();
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
                Welcome to Hugity, { user?.firstName }!
            </h2>
            <Button onClick={onCreate}>
                <PlusCircleIcon className="h-4 w-4 mr-2" />
                Create a website
            </Button>
        </div>
     );
}
 
export default DocumentsPage;