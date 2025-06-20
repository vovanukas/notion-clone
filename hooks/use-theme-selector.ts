import { create } from "zustand";

interface ThemeSelectorStore {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: (data: { siteName: string; templateFolder: string }) => void;
}

export const useThemeSelector = create<ThemeSelectorStore>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
  onSubmit: (data) => {
    console.log("Creating website:", data);
    set({ isOpen: false });
  },
})); 