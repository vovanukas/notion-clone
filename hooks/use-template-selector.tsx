import { create } from "zustand";

interface TemplateSelectorStore {
  isOpen: boolean;
  selectedTemplate: string | null;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (templateName: string | null) => void;
  onConfirm: () => void;
}

export const useTemplateSelector = create<TemplateSelectorStore>((set, get) => ({
  isOpen: false,
  selectedTemplate: null,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
  onSelect: (templateName: string | null) => set({ selectedTemplate: templateName }),
  onConfirm: () => {
    set({ isOpen: false });
  },
})); 