"use client";

import { useEffect, useState } from "react";

import { CoverImageModal } from "@/components/modals/cover-image-modal";
import { ThemeSelectorModal } from "@/components/modals/theme-selector-modal";
// TODO: Re-enable onboarding when updated video is available
// import { OnboardingModal } from "@/components/modals/onboarding-modal";

export const ModalProvider = () => {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return null;
    }

    return (
        <>
            <CoverImageModal />
            <ThemeSelectorModal />
            {/* TODO: Re-enable onboarding when updated video is available */}
            {/* <OnboardingModal /> */}
        </>
    )
}