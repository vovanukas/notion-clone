import { create } from "zustand";

type ChangedFile = {
  path: string;
  content: string;
  title?: string;
  sha?: string;
};

type UnsavedChangesStore = {
  changedFiles: ChangedFile[];
  addChangedFile: (path: string, content: string, sha?: string, title?: string) => void;
  updateFileContent: (path: string, content: string) => void;
  updateTitle: (path: string, title: string) => void;
  resetChangedFiles: () => void;
  hasUnsavedChanges: () => boolean;
};

export const useUnsavedChanges = create<UnsavedChangesStore>((set, get) => ({
  changedFiles: [],
  
  addChangedFile: (path, content, sha, title) =>
    set((state) => {
      const existingFile = state.changedFiles.find(file => file.path === path);
      if (existingFile) {
        // If path already exists, update its content and sha
        existingFile.content = content;
        existingFile.sha = sha;
        if (title !== undefined) {
          existingFile.title = title;
        }
        return { changedFiles: [...state.changedFiles] }; // Forces a re-render even if objects are technically not new
      } else {
        return {
          changedFiles: [...state.changedFiles, { path, content, sha, title }],
        };
      }
    }),

  updateFileContent: (path, content) =>
    set((state) => {
      return {
        changedFiles: state.changedFiles.map(file =>
          file.path === path ? { ...file, content } : file
        ),
      };
    }),

  updateTitle: (path, title) =>
    set((state) => {
      const existingFile = state.changedFiles.find(file => file.path === path);
      if (existingFile) {
        existingFile.title = title;
        return { changedFiles: [...state.changedFiles] };
      } else {
        return {
          changedFiles: [...state.changedFiles, { path, content: '', title }],
        };
      }
    }),
  
  resetChangedFiles: () => {
    set({ changedFiles: [] });
  },
  
  hasUnsavedChanges: () => {
    const hasChanges = get().changedFiles.length > 0;
    return hasChanges;
  },
}));