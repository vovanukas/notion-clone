"use client";

import { create } from "zustand";
import { FileContent, HugoFrontmatter } from "@/types/hugo";

type ChangedFile = FileContent & HugoFrontmatter;

type UnsavedChangesStore = {
  changedFiles: ChangedFile[];
  updateFile: (path: string, updates: Partial<Omit<ChangedFile, 'path'>>) => void;
  resetChangedFiles: () => void;
  hasUnsavedChanges: () => boolean;
};

export const useUnsavedChanges = create<UnsavedChangesStore>((set, get) => ({
  changedFiles: [],
  
  updateFile: (path, updates) =>
    set((state) => {
      // Decode the path to prevent double-encoding
      const decodedPath = decodeURIComponent(path);
      const existingFile = state.changedFiles.find(file => file.path === decodedPath);

      // Process updates to handle dates and other special types
      const processedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value instanceof Date) {
          acc[key] = value.toISOString();
        } else {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      if (existingFile) {
        Object.assign(existingFile, processedUpdates);
        const newState = { changedFiles: [...state.changedFiles] };
        console.log('Updated file:', newState.changedFiles);
        return newState;
      } else {
        const newFile: ChangedFile = {
          path: decodedPath,
          content: '',
          ...processedUpdates
        };
        const newState = {
          changedFiles: [...state.changedFiles, newFile],
        };
        console.log('Added new file:', newState.changedFiles);
        return newState;
      }
    }),
  
  resetChangedFiles: () => {
    set({ changedFiles: [] });
    console.log('Reset all changed files');
  },
  
  hasUnsavedChanges: () => get().changedFiles.length > 0,
}));