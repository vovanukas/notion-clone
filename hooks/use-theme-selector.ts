import { create } from "zustand";

interface ThemeSelectorStore {
  isOpen: boolean;
  onSubmit: (themeUrl: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

export const useThemeSelector = create<ThemeSelectorStore>((set) => ({
  isOpen: false,
  onSubmit: () => {},
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
})); 