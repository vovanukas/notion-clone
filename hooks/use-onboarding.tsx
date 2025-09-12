import { create } from "zustand";

type OnboardingStore = {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
};

export const useOnboarding = create<OnboardingStore>((set) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
}));
