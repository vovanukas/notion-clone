"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export const OnboardingModal = () => {
    const onboarding = useOnboarding();
    const { user } = useUser();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const completeOnboarding = useAction(api.github.completeOnboarding);

    const handleComplete = async () => {
        setIsLoading(true);
        try {
            await completeOnboarding();
            // Reload user data to get updated publicMetadata
            await user?.reload();
            onboarding.onClose();
            // Force a refresh to update session claims
            router.refresh();
        } catch (error) {
            console.error("Error completing onboarding:", error);
            // Still close the modal to avoid blocking the user
            onboarding.onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        await handleComplete(); // Same as completing - marks as done
    };

    return (
        <Dialog open={onboarding.isOpen}>
            <DialogContent 
                className="w-[95vw] max-w-[700px] max-h-[90vh] p-0 gap-0 [&>button]:hidden" 
                onPointerDownOutside={(e) => e.preventDefault()} 
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader className="p-4 sm:p-6 pb-2">
                    <DialogTitle className="text-xl sm:text-2xl font-bold">
                        Welcome to Hugity! 🎉
                    </DialogTitle>
                    <DialogDescription className="text-sm sm:text-base mt-2">
                        Let&apos;s get you started with a quick overview of how to create and manage your websites.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 sm:px-6 flex-1 overflow-y-auto">
                    {/* Video Container */}
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden mb-4 sm:mb-6">
                        <iframe
                            src="https://www.youtube.com/embed/VXWjYOb_yMs"
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between p-4 sm:p-6 pt-0 border-t border-gray-100 dark:border-gray-800">
                    <Button
                        variant="outline"
                        onClick={handleSkip}
                        disabled={isLoading}
                        className="w-full sm:w-auto order-2 sm:order-1"
                        size="sm"
                    >
                        Skip for now
                    </Button>
                    <Button
                        onClick={handleComplete}
                        disabled={isLoading}
                        className="w-full sm:w-auto order-1 sm:order-2"
                        size="sm"
                    >
                        {isLoading ? "Completing..." : "Got it! Let's start building"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
