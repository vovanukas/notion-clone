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
                        {/* Replace this div with your actual video component/embed */}
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center px-4">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                </div>
                                <p className="text-xs sm:text-sm font-medium">Your onboarding video will appear here</p>
                                <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                                    Replace this with iframe, video tag, or your preferred video solution
                                </p>
                                <div className="mt-2 sm:mt-4 text-xs text-gray-400 space-y-1 hidden sm:block">
                                    <p>Examples:</p>
                                    <p>• YouTube: &lt;iframe src=&quot;https://www.youtube.com/embed/VIDEO_ID&quot;&gt;</p>
                                    <p>• Vimeo: &lt;iframe src=&quot;https://player.vimeo.com/video/VIDEO_ID&quot;&gt;</p>
                                    <p>• Local video: &lt;video src=&quot;/path-to-video.mp4&quot;&gt;</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Example of how you might embed a video:
                        <iframe
                            src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                        */}
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
