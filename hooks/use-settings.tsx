import { create } from "zustand";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Simplified types
export type SettingsSection = {
  key: string;
  title: string;
};

type SettingsStore = {
  currentSection: string | null;
  formData: Record<string, any>;

  // Actions
  setCurrentSection: (section: string | null) => void;
  updateFormData: (data: Record<string, any>) => void;
};

export const useSettings = create<SettingsStore>((set) => ({
  currentSection: null,
  formData: {},

  setCurrentSection: (section) => set({ currentSection: section }),
  updateFormData: (data) => set(state => ({ formData: { ...state.formData, ...data } })),
}));

// Hook to get template schema from database
export const useTemplateSchema = (theme: string | undefined) => {
  return useQuery(
    api.hugoTemplates.getTemplateByFolder,
    theme ? { folderName: theme } : "skip"
  );
};

// Helper function to extract sections from schema
export const getSectionsFromSchema = (schema: any, uiSchema?: any): SettingsSection[] => {
  if (!schema?.properties) return [];

  const sections = Object.entries(schema.properties).map(([key, value]: [string, any]) => ({
    key,
    title: value.title || key,
  }));

  // If UI schema has a root-level ui:order, use it to order the sections
  if (uiSchema?.['ui:order']) {
    const orderedKeys = uiSchema['ui:order'];
    const sectionsMap = new Map(sections.map(section => [section.key, section]));

    // Return sections in the order specified by ui:order
    const orderedSections = orderedKeys
      .map((key: string) => sectionsMap.get(key))
      .filter(Boolean); // Remove any undefined entries

    // Add any sections not in ui:order at the end
    const unorderedSections = sections.filter(section =>
      !orderedKeys.includes(section.key)
    );

    return [...orderedSections, ...unorderedSections];
  }

  // Fallback to schema property order (may not be reliable)
  return sections;
};