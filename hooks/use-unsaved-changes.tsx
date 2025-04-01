import { create } from "zustand";

type ChangedFile = {
  path: string;
  content: string;
  sha?: string;
};

type UnsavedChangesStore = {
  changedFiles: ChangedFile[];
  addChangedFile: (path: string, content: string, sha?: string) => void;
  updateFileContent: (path: string, content: string) => void;
  resetChangedFiles: () => void;
  hasUnsavedChanges: () => boolean;
};

export const useUnsavedChanges = create<UnsavedChangesStore>((set, get) => ({
  changedFiles: [],
  
  addChangedFile: (path, content, sha) =>
    set((state) => {
      const existingFile = state.changedFiles.find(file => file.path === path);
      if (existingFile) {
        // If path already exists, update its content and sha
        existingFile.content = content;
        existingFile.sha = sha;
        return { changedFiles: [...state.changedFiles] }; // Forces a re-render even if objects are technically not new
      } else {
        return {
          changedFiles: [...state.changedFiles, { path, content, sha }],
        };
      }
    }),

  updateFileContent: (path, content) =>
    set((state) => ({
      changedFiles: state.changedFiles.map(file =>
        file.path === path ? { ...file, content } : file
      ),
    })),
  
  resetChangedFiles: () => set({ changedFiles: [] }),
  
  hasUnsavedChanges: () => get().changedFiles.length > 0,
}));