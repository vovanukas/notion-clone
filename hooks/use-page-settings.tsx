import { create } from "zustand";

type PageSettingsStore = {
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
}

export const usePageSettings = create<PageSettingsStore>((set) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false })
})) 