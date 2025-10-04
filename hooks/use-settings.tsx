import { create } from "zustand";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCallback } from "react";
import matter from "gray-matter";
import { parse as parseTOML, stringify as stringifyTOML } from "smol-toml";
import { flatten, unflatten } from "flat";

// Simplified types
export type SettingsSection = {
  key: string;
  title: string;
};

// Config file type from GitHub API
export interface ConfigFile {
  content: string;
  path: string;
  name: string;
  isDirectory: boolean;
}

type SettingsStore = {
  currentSection: string | null;
  setCurrentSection: (section: string | null) => void;
  
  // Settings change tracking
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  currentFormData: Record<string, any> | null;
  setCurrentFormData: (formData: Record<string, any> | null) => void;
  originalFormData: Record<string, any> | null;
  setOriginalFormData: (formData: Record<string, any> | null) => void;
  
  // Save function reference
  saveFunction: (() => Promise<void>) | null;
  setSaveFunction: (saveFunction: (() => Promise<void>) | null) => void;
  isSaving: boolean;
  setIsSaving: (isSaving: boolean) => void;
};

export const useSettings = create<SettingsStore>((set, get) => ({
  currentSection: null,
  setCurrentSection: (section) => set({ currentSection: section }),
  
  // Settings change tracking
  hasUnsavedChanges: false,
  setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
  currentFormData: null,
  setCurrentFormData: (formData) => {
    set({ currentFormData: formData });
    // Check if there are changes compared to original
    const { originalFormData } = get();
    if (originalFormData && formData) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalFormData);
      set({ hasUnsavedChanges: hasChanges });
    }
  },
  originalFormData: null,
  setOriginalFormData: (formData) => set({ originalFormData: formData, hasUnsavedChanges: false }),
  
  // Save function reference
  saveFunction: null,
  setSaveFunction: (saveFunction) => set({ saveFunction }),
  isSaving: false,
  setIsSaving: (isSaving) => set({ isSaving }),
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

  // Filter out hidden sections first
  const visibleSections = Object.entries(schema.properties)
    .filter(([key]: [string, any]) => {
      // Check if this section is hidden in UI schema
      const sectionUISchema = uiSchema?.[key];
      return sectionUISchema?.['ui:widget'] !== 'hidden';
    })
    .map(([key, value]: [string, any]) => ({
      key,
      title: value.title || key,
    }));

  // If UI schema has a root-level ui:order, use it to order the sections
  if (uiSchema?.['ui:order']) {
    const orderedKeys = uiSchema['ui:order'];
    const sectionsMap = new Map(visibleSections.map(section => [section.key, section]));

    // Return sections in the order specified by ui:order (only visible ones)
    const orderedSections = orderedKeys
      .map((key: string) => sectionsMap.get(key))
      .filter(Boolean); // Remove any undefined entries

    // Add any visible sections not in ui:order at the end
    const unorderedSections = visibleSections.filter(section =>
      !orderedKeys.includes(section.key)
    );

    return [...orderedSections, ...unorderedSections];
  }

  // Fallback to schema property order (may not be reliable)
  return visibleSections;
};

/**
 * Hook for managing config fetching - Step 1 implementation
 */
export const useConfigFetcher = () => {
  const fetchAllConfigs = useAction(api.github.fetchAllConfigFiles);

  const fetchAndLogConfigs = useCallback(async (documentId: Id<"documents">) => {
    try {
      const configFiles = await fetchAllConfigs({ id: documentId });
      const formData = parseConfigsToFormData(configFiles);
      const flattenedFormData = flattenFormDataWithLibrary(formData);
      return { configFiles, formData: flattenedFormData };
    } catch (error) {
      console.error('Error fetching configs:', error);
      throw error;
    }
  }, [fetchAllConfigs]);

  return { fetchAndLogConfigs };
};

/**
 * Step 2.5: Flatten nested objects using the 'flat' library
 * Converts nested objects like "config.toml/params": {text_color: ""} 
 * into flat keys like "config.toml/params.text_color": ""
 */
const flattenFormDataWithLibrary = (formData: Record<string, any>): Record<string, any> => {
  return flatten(formData, {
    safe: true,        // Preserve arrays
    delimiter: '.'     // Use dots for nested keys
  });
};

/**
 * Step 3: Simple category enrichment with flattened data
 * Now that data is flattened, we can do direct key matching
 */
export const enrichFormDataWithCategories = (
  flatFormData: Record<string, any>, 
  schema: any
): Record<string, any> => {
  // Filter out any category keys from input to prevent double processing
  const cleanFormData: Record<string, any> = {};
  const categoryKeys = ['general', 'appearance', 'content', 'social', 'seo', 'multilingual', 'advanced', '_preserved'];
  
  Object.entries(flatFormData).forEach(([key, value]) => {
    if (!categoryKeys.includes(key)) {
      cleanFormData[key] = value;
    }
  });
  
  const enrichedFormData: Record<string, any> = {};
  const processedKeys = new Set<string>();
  
  // Process each schema category
  if (schema?.properties) {
    Object.entries(schema.properties).forEach(([categoryKey, categorySchema]: [string, any]) => {
      enrichedFormData[categoryKey] = {};
      
      if (categorySchema.properties) {
        Object.keys(categorySchema.properties).forEach(schemaPath => {
          if (cleanFormData.hasOwnProperty(schemaPath)) {
            enrichedFormData[categoryKey][schemaPath] = cleanFormData[schemaPath];
            processedKeys.add(schemaPath);
          }
        });
      }
    });
  }
  
  // Handle unmatched fields in misc category
  const unmatchedKeys = Object.keys(cleanFormData).filter(key => !processedKeys.has(key));
  if (unmatchedKeys.length > 0) {
    enrichedFormData['misc'] = {};
    unmatchedKeys.forEach(key => {
      enrichedFormData['misc'][key] = cleanFormData[key];
    });
  }
  
  return enrichedFormData;
};

/**
 * Step 3.5: Inject schema defaults for missing/empty/undefined fields
 * Used on form submission to ensure all empty fields get their schema defaults
 */
export const injectSchemaDefaults = (
  formData: Record<string, any>,
  schema: any
): Record<string, any> => {
  const formDataWithDefaults = JSON.parse(JSON.stringify(formData)); // Deep clone
  
  if (schema?.properties) {
    Object.entries(schema.properties).forEach(([categoryKey, categorySchema]: [string, any]) => {
      // Ensure category exists in form data
      if (!formDataWithDefaults[categoryKey]) {
        formDataWithDefaults[categoryKey] = {};
      }
      
      if (categorySchema.properties) {
        Object.entries(categorySchema.properties).forEach(([fieldPath, fieldSchema]: [string, any]) => {
          const currentValue = formDataWithDefaults[categoryKey][fieldPath];
          const schemaDefault = (fieldSchema as any).default;
          const fieldType = (fieldSchema as any).type;

          const isEmpty = currentValue === undefined || currentValue === null || 
                         (typeof currentValue === 'string' && currentValue === "") ||
                         (Array.isArray(currentValue) && currentValue.length === 0);
          
          if (isEmpty) {
            if (schemaDefault !== undefined) {
              // Use schema default
              formDataWithDefaults[categoryKey][fieldPath] = schemaDefault;
            } else {
              // Provide Hugo-safe empty value based on type
              let hugoSafeDefault;
              switch (fieldType) {
                case 'string':
                  hugoSafeDefault = "";
                  break;
                case 'integer':
                case 'number':
                  hugoSafeDefault = 0;
                  break;
                case 'boolean':
                  hugoSafeDefault = false;
                  break;
                case 'array':
                  hugoSafeDefault = [];
                  break;
                case 'object':
                  hugoSafeDefault = {};
                  break;
                default:
                  hugoSafeDefault = "";
              }
              formDataWithDefaults[categoryKey][fieldPath] = hugoSafeDefault;
            }
          }
        });
      }
    });
  }
  
  return formDataWithDefaults;
};

/**
 * Step 4: Remove categories and flatten back to simple key-value structure
 * Converts categorized form data back to a flat structure for saving to config files.
 */
export const removeCategoriesFromFormData = (
  formDataWithCategories: Record<string, Record<string, any>>
): Record<string, any> => {
  const flatFormData: Record<string, any> = {};
  
  Object.entries(formDataWithCategories).forEach(([, categoryData]) => {
    Object.entries(categoryData).forEach(([fieldPath, value]) => {
      flatFormData[fieldPath] = value;
    });
  });
  
  return flatFormData;
};

/**
 * Step 4.5: Escape special characters in flat form data keys
 * Apply this before unflattening to prevent misinterpretation of special characters
 * ONLY escapes the key portion after the file extension, not the file paths
 */
export const escapeSpecialCharsInKeys = (flatFormData: Record<string, any>): Record<string, any> => {
  const escapedFormData: Record<string, any> = {};
  
  // Define characters that need escaping to prevent flat library misinterpretation
  const escapeMap = {
    '/': '___SLASH___',
    '+': '___PLUS___',
    '"': '___QUOTE___',
    ':': '___COLON___',
    '@': '___AT___',
    '#': '___HASH___',
    '%': '___PERCENT___',
    '&': '___AMP___',
    '=': '___EQUALS___',
    '?': '___QUESTION___'
  };
  
  Object.entries(flatFormData).forEach(([key, value]) => {
    // Split the key into file path and config key portions
    const match = key.match(/^(.+\.(toml|yaml|yml|json))\/(.+)$/);
    
    if (match) {
      const [, filePath, , configKey] = match;
      
      // Only escape special characters in the config key portion
      let escapedConfigKey = configKey;
      Object.entries(escapeMap).forEach(([char, replacement]) => {
        escapedConfigKey = escapedConfigKey.replace(new RegExp(`\\${char}`, 'g'), replacement);
      });
      
      // Reconstruct the full key with escaped config key
      const escapedKey = `${filePath}/${escapedConfigKey}`;
      escapedFormData[escapedKey] = value;
    } else {
      // No file extension pattern found, keep as-is
      escapedFormData[key] = value;
    }
  });
  
  return escapedFormData;
};

/**
 * Step 5: Unflatten the flat formData back to nested structure by file
 * Groups fields by file path and unflattens nested keys using the flat library.
 */
export const unflattenFormDataByFile = (
  flatFormData: Record<string, any>
): Record<string, Record<string, any>> => {
  const fileGroups: Record<string, Record<string, any>> = {};
  
  // Group fields by file path
  Object.entries(flatFormData).forEach(([fieldPath, value]) => {
    const parts = fieldPath.split('/');

    // Find the actual file path by looking for valid file extensions
    let filePathParts: string[] = [];
    let keyParts: string[] = [];

    // Look for the last occurrence of a valid config file extension
    let lastFileIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].match(/\.(toml|yaml|yml|json)$/)) {
        lastFileIndex = i;
        break;
      }
    }

    if (lastFileIndex >= 0) {
      // Found a valid file extension - split there
      filePathParts = parts.slice(0, lastFileIndex + 1);
      keyParts = parts.slice(lastFileIndex + 1);
    } else {
      // No valid file extension found - this shouldn't happen with proper schema keys
      console.warn(`⚠️ No valid file extension found in path: ${fieldPath}`);
      // Fallback: assume first part is file path
      filePathParts = [parts[0]];
      keyParts = parts.slice(1);
    }

    const filePath = filePathParts.join('/');
    const key = keyParts.join('.');

    // Skip if we couldn't determine a valid file path
    if (!filePath || filePath.trim() === '') {
      console.warn(`⚠️ Skipping invalid file path: ${fieldPath}`);
      return;
    }
    
    if (!fileGroups[filePath]) {
      fileGroups[filePath] = {};
    }
    
    fileGroups[filePath][key] = value;
  });
  
  // Debug: Log file groups before unflattening
  console.group('🔍 Step 5: Unflattening by file');
  console.log('File groups:', Object.keys(fileGroups));
  Object.entries(fileGroups).forEach(([filePath, data]) => {
    console.log(`${filePath}:`, Object.keys(data));
  });
  console.groupEnd();
  
  // Unflatten each file's data using the flat library with escaping
  const unflattenedFiles: Record<string, Record<string, any>> = {};
  
  Object.entries(fileGroups).forEach(([filePath, flatData]) => {
    try {
      // Use flat library to unflatten nested keys with transformKey to handle special characters
      const unflattened = unflatten(flatData, { 
        delimiter: '.', 
        safe: true,
        transformKey: function(key) {
          // Unescape special characters back to original form
          return key
            .replace(/___SLASH___/g, '/')
            .replace(/___PLUS___/g, '+')
            .replace(/___QUOTE___/g, '"');
        }
      }) as Record<string, any>;

      unflattenedFiles[filePath] = unflattened;
    } catch (error) {
      console.error(`Error unflattening ${filePath}:`, error);
      // Fallback: keep flat structure
      unflattenedFiles[filePath] = flatData;
    }
  });
  
  return unflattenedFiles;
};

/**
 * Step 6: Convert unflattened nested structure back to TOML/YAML strings
 * Takes the nested objects and converts them back to config file format.
 */
export const convertToConfigStrings = (
  unflattenedByFile: Record<string, Record<string, any>>
): Record<string, string> => {
  const configStrings: Record<string, string> = {};
  
  Object.entries(unflattenedByFile).forEach(([filePath, configData]) => {
    try {
      const extension = filePath.split('.').pop()?.toLowerCase();
      let configString = '';
      
      switch (extension) {
        case 'toml':
          configString = stringifyTOML(configData);
          break;
          
        case 'yaml':
        case 'yml':
          // For YAML, we'll use gray-matter to stringify
          configString = matter.stringify('', configData);
          // Remove the frontmatter delimiters since we want pure YAML
          configString = configString.replace(/^---\n/, '').replace(/\n---\n$/, '');
          break;
          
        case 'json':
          configString = JSON.stringify(configData, null, 2);
          break;
          
        default:
          console.warn(`Unknown file extension: ${extension}, defaulting to TOML`);
          configString = stringifyTOML(configData);
      }
      
      configStrings[filePath] = configString;
      
    } catch (error) {
      console.error(`Error converting ${filePath}:`, error);
      // Fallback: JSON stringify
      configStrings[filePath] = JSON.stringify(configData, null, 2);
    }
  });
  
  return configStrings;
};

/**
 * Step 7: Save config strings to GitHub
 * Takes the config strings and saves them back to the GitHub repository.
 */
export const saveConfigStringsToGitHub = async (
  configStrings: Record<string, string>,
  documentId: string,
  convexAction: any
): Promise<void> => {
  try {
    // Convert config strings to the format expected by the Convex action
    const configFiles = Object.entries(configStrings).map(([filePath, content]) => ({
      content,
      path: filePath,
      name: filePath.split('/').pop() || filePath,
      isDirectory: false
    }));
    
    // Debug: Log what we're sending to GitHub
    console.group('🔍 Saving config files to GitHub');
    console.log('Config files to save:', configFiles.map(f => ({
      path: f.path,
      name: f.name,
      contentLength: f.content.length
    })));

    // Validate file paths
    const validatedFiles = configFiles.filter(file => {
      if (!file.path || file.path.trim() === '') {
        console.warn('⚠️ Skipping empty file path:', file);
        return false;
      }
      if (file.path.includes('//') || file.path.startsWith('/') || file.path.endsWith('/')) {
        console.warn('⚠️ Invalid file path format:', file.path);
        return false;
      }
      return true;
    });
    
    // Check for duplicates
    const pathCounts = validatedFiles.reduce((acc, file) => {
      acc[file.path] = (acc[file.path] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const duplicates = Object.entries(pathCounts).filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      console.error('❌ Duplicate file paths detected:', duplicates);
      throw new Error(`Duplicate file paths: ${duplicates.map(([path]) => path).join(', ')}`);
    }

    console.log('✅ Validated files:', validatedFiles.length);
    console.groupEnd();

    // Call the Convex action to save multiple config files
    await convexAction({
      id: documentId,
      configFiles: validatedFiles
    });
    
  } catch (error) {
    console.error('Failed to save config files:', error);
    throw new Error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Step 2: Parse raw config files into formData with file path prefixes
 * Takes ConfigFile[] and returns flat object with "filepath/key" structure
 */
export const parseConfigsToFormData = (configFiles: ConfigFile[]): Record<string, any> => {
  const formData: Record<string, any> = {};

  configFiles.forEach((file) => {
    try {
      let configData: Record<string, any> = {};

      // Determine file type and parse accordingly
      const extension = file.path.split('.').pop()?.toLowerCase();

      switch (extension) {
        case 'toml':
          configData = parseTOML(file.content);
          break;

        case 'yaml':
        case 'yml':
          // For YAML, we can use gray-matter with proper frontmatter format
          const yamlWithFrontmatter = `---\n${file.content}\n---\n`;
          const parsed = matter(yamlWithFrontmatter);
          configData = parsed.data;
          break;

        case 'json':
          configData = JSON.parse(file.content);
          break;

        default:
          console.warn(`Unknown file extension: ${extension}, attempting TOML parse...`);
          configData = parseTOML(file.content);
      }

      // Prepend file path to each top-level key
      Object.entries(configData).forEach(([key, value]) => {
        const prefixedKey = `${file.path}/${key}`;
        formData[prefixedKey] = value;
      });

    } catch (error) {
      console.error(`Error parsing ${file.path}:`, error);
    }
  });

  return formData;
};