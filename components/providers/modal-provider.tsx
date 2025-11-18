"use client";

import { useEffect, useState } from "react";

import { CoverImageModal } from "@/components/modals/cover-image-modal";
import { ThemeSelectorModal } from "@/components/modals/theme-selector-modal";
import { OnboardingModal } from "@/components/modals/onboarding-modal";

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
            <OnboardingModal />
        </>
    )
}