"use client";

import { useEffect, useState } from "react";

import { SettingsModal } from "@/components/modals/settings-modal";
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
            <SettingsModal />
            <CoverImageModal />
            <ThemeSelectorModal />
            <OnboardingModal />
        </>
    )
}