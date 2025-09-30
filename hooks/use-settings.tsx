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
};

export const useSettings = create<SettingsStore>((set) => ({
  currentSection: null,
  setCurrentSection: (section) => set({ currentSection: section }),
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
 * Step 1: Simple config fetcher that logs config files to console
 * Fetches all config files from GitHub and prints them
 */
export const fetchAndLogConfigs = async (documentId: Id<"documents">) => {
  try {
    console.group('🔧 Step 1: Fetching Config Files');
    console.log('Document ID:', documentId);

    // Use the same GitHub API action as page.tsx
    const fetchAllConfigs = api.github.fetchAllConfigFiles;

    // Note: This is a placeholder - we'll need to call this from a component
    // that has access to useAction hook
    console.log('Config fetcher function created - ready to be called from component');
    console.groupEnd();

  } catch (error) {
    console.error('Error in fetchAndLogConfigs:', error);
  }
};

/**
 * Hook for managing config fetching - Step 1 implementation
 */
export const useConfigFetcher = () => {
  const fetchAllConfigs = useAction(api.github.fetchAllConfigFiles);

  const fetchAndLogConfigs = useCallback(async (documentId: Id<"documents">) => {
    try {
      console.group('🔧 Step 1: Fetching Config Files');
      console.log('Document ID:', documentId);
      console.log('Starting config fetch...');

      const configFiles = await fetchAllConfigs({ id: documentId });

      console.log('✅ Config files fetched successfully!');
      console.log('Number of files:', configFiles.length);
      console.log('Config files:', configFiles);

      // Log each file individually for clarity
      configFiles.forEach((file, index) => {
        console.group(`📄 Config File ${index + 1}: ${file.path}`);
        console.log('Path:', file.path);
        console.log('Name:', file.name);
        console.log('Is Directory:', file.isDirectory);
        console.log('Content preview:', file.content.substring(0, 200) + '...');
        console.log('Full content:', file.content);
        console.groupEnd();
      });

      console.groupEnd();

      // Step 2: Parse the configs to formData
      const formData = parseConfigsToFormData(configFiles);
      
      // Step 2.5: Flatten nested objects using the 'flat' library
      const flattenedFormData = flattenFormDataWithLibrary(formData);

      return { configFiles, formData: flattenedFormData };

    } catch (error) {
      console.error('❌ Error fetching configs:', error);
      console.groupEnd();
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
  console.group('🔧 Step 2.5: Flattening with flat library');
  console.log('Input formData keys:', Object.keys(formData).length);
  console.log('Input formData:', formData);
  
  const flattened = flatten(formData, {
    safe: true,        // Preserve arrays
    delimiter: '.'     // Use dots for nested keys
  });
  
  console.log('🎯 Flattened FormData:');
  console.log(flattened);
  console.log('Total flattened keys:', Object.keys(flattened).length);
  
  // Show the transformation
  console.log('📊 Flattening Examples:');
  Object.entries(flattened).slice(0, 5).forEach(([key, value]) => {
    console.log(`  "${key}":`, typeof value === 'object' ? '[Object/Array]' : value);
  });
  
  console.groupEnd();
  return flattened;
};

/**
 * Step 3: Simple category enrichment with flattened data
 * Now that data is flattened, we can do direct key matching
 */
export const enrichFormDataWithCategories = (
  flatFormData: Record<string, any>, 
  schema: any
): Record<string, any> => {
  console.group('🔧 Step 3: Enriching Flattened FormData with Categories');
  console.log('Input flattened formData keys:', Object.keys(flatFormData).length);
  console.log('Schema categories:', Object.keys(schema?.properties || {}));
  
  // Debug: Check if formData looks like it's already been processed
  const hasCategories = Object.keys(flatFormData).some(key => 
    ['general', 'appearance', 'content', 'social', 'seo', 'multilingual', 'advanced', '_preserved'].includes(key)
  );
  console.log('⚠️ FormData contains category keys (double processing?):', hasCategories);
  
  // Filter out any category keys from input to prevent double processing
  const cleanFormData: Record<string, any> = {};
  const categoryKeys = ['general', 'appearance', 'content', 'social', 'seo', 'multilingual', 'advanced', '_preserved'];
  
  Object.entries(flatFormData).forEach(([key, value]) => {
    if (!categoryKeys.includes(key)) {
      cleanFormData[key] = value;
    } else {
      console.log(`🧹 Filtered out category key: "${key}"`);
    }
  });
  
  console.log('🧽 Clean formData after filtering:', cleanFormData);
  console.log('🧽 Clean formData keys:', Object.keys(cleanFormData).length);
  
  const enrichedFormData: Record<string, any> = {};
  const processedKeys = new Set<string>();
  
  // Process each schema category
  if (schema?.properties) {
    Object.entries(schema.properties).forEach(([categoryKey, categorySchema]: [string, any]) => {
      console.group(`📁 Category: ${categoryKey}`);
      
      enrichedFormData[categoryKey] = {};
      let matchCount = 0;
      
      if (categorySchema.properties) {
        Object.keys(categorySchema.properties).forEach(schemaPath => {
          if (cleanFormData.hasOwnProperty(schemaPath)) {
            enrichedFormData[categoryKey][schemaPath] = cleanFormData[schemaPath];
            processedKeys.add(schemaPath);
            matchCount++;
            console.log(`✅ Matched: "${schemaPath}"`, 
              typeof cleanFormData[schemaPath] === 'object' ? '[Object/Array]' : cleanFormData[schemaPath]);
          }
        });
      }
      
      console.log(`📊 Total matches: ${matchCount}`);
      console.groupEnd();
    });
  }
  
  // Handle unmatched fields
  const unmatchedKeys = Object.keys(cleanFormData).filter(key => !processedKeys.has(key));
  if (unmatchedKeys.length > 0) {
    console.group('📦 Misc Settings');
    enrichedFormData['misc'] = {};
    
    unmatchedKeys.forEach(key => {
      enrichedFormData['misc'][key] = cleanFormData[key];
      console.log(`🔍 Unmatched: "${key}"`, 
        typeof cleanFormData[key] === 'object' ? '[Object/Array]' : cleanFormData[key]);
    });
    
    console.log(`📊 Total unmatched: ${unmatchedKeys.length}`);
    console.groupEnd();
  }
  
  console.log('🎯 Final Enriched Structure:');
  Object.entries(enrichedFormData).forEach(([category, fields]) => {
    console.log(`📁 ${category}: ${Object.keys(fields as Record<string, any>).length} fields`);
  });
  console.groupEnd();
  
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
  console.group('🔧 Step 3.5: Injecting Schema Defaults (Form Submission)');
  console.log('Input form data categories:', Object.keys(formData));
  
  const formDataWithDefaults = JSON.parse(JSON.stringify(formData)); // Deep clone
  let defaultsInjected = 0;
  
  if (schema?.properties) {
    Object.entries(schema.properties).forEach(([categoryKey, categorySchema]: [string, any]) => {
      console.group(`📁 Processing defaults for: ${categoryKey}`);
      
      // Ensure category exists in form data
      if (!formDataWithDefaults[categoryKey]) {
        formDataWithDefaults[categoryKey] = {};
        console.log(`📂 Created missing category: ${categoryKey}`);
      }
      
      if (categorySchema.properties) {
        Object.entries(categorySchema.properties).forEach(([fieldPath, fieldSchema]: [string, any]) => {
          const currentValue = formDataWithDefaults[categoryKey][fieldPath];
          const schemaDefault = (fieldSchema as any).default;
          
          // Smart Hugo-safe default injection based on field type and schema default
          const fieldType = (fieldSchema as any).type;
          const isEmpty = currentValue === undefined || currentValue === null || 
                         (typeof currentValue === 'string' && currentValue === "") ||
                         (Array.isArray(currentValue) && currentValue.length === 0);
          
          if (!isEmpty) {
            // User has entered a value - always keep it
            console.log(`➡️ Kept user value for "${fieldPath}":`, 
              typeof currentValue === 'object' ? '[Object/Array]' : `"${currentValue}"`);
          } else if (schemaDefault !== undefined) {
            // Schema has a default - use it (whether empty string, number, boolean, array, etc.)
            formDataWithDefaults[categoryKey][fieldPath] = schemaDefault;
            if (schemaDefault === "" || (Array.isArray(schemaDefault) && schemaDefault.length === 0)) {
              console.log(`📝 Set optional field "${fieldPath}" to Hugo-safe empty value:`, 
                Array.isArray(schemaDefault) ? '[]' : '""');
            } else {
              defaultsInjected++;
              console.log(`✅ Injected required default for "${fieldPath}":`, 
                typeof schemaDefault === 'object' ? '[Object/Array]' : `"${schemaDefault}"`);
            }
          } else {
            // No schema default - provide Hugo-safe empty value based on type
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
            console.log(`🛡️ Set Hugo-safe default for "${fieldPath}" (${fieldType}):`, 
              typeof hugoSafeDefault === 'object' ? '[Object/Array]' : `"${hugoSafeDefault}"`);
          }
        });
      }
      
      console.groupEnd();
    });
  }
  
  console.log(`🎯 Total defaults injected: ${defaultsInjected}`);
  console.log('✅ Form data ready for config file conversion');
  console.groupEnd();
  
  return formDataWithDefaults;
};

/**
 * Step 4: Remove categories and flatten back to simple key-value structure
 * Converts categorized form data back to a flat structure for saving to config files.
 */
export const removeCategoriesFromFormData = (
  formDataWithCategories: Record<string, Record<string, any>>
): Record<string, any> => {
  console.group('🔄 Step 4: Removing Categories');
  
  const flatFormData: Record<string, any> = {};
  let fieldsProcessed = 0;
  
  Object.entries(formDataWithCategories).forEach(([categoryKey, categoryData]) => {
    console.group(`📂 Processing category: ${categoryKey}`);
    
    Object.entries(categoryData).forEach(([fieldPath, value]) => {
      flatFormData[fieldPath] = value;
      fieldsProcessed++;
      console.log(`➡️ Moved "${fieldPath}":`, 
        typeof value === 'object' ? '[Object/Array]' : `"${value}"`);
    });
    
    console.groupEnd();
  });
  
  console.log(`✨ Categories removed! Processed ${fieldsProcessed} fields`);
  console.log('📋 Final flat structure:', Object.keys(flatFormData));
  console.groupEnd();
  
  return flatFormData;
};

/**
 * Step 5: Unflatten the flat formData back to nested structure by file
 * Groups fields by file path and unflattens nested keys using the flat library.
 */
export const unflattenFormDataByFile = (
  flatFormData: Record<string, any>
): Record<string, Record<string, any>> => {
  console.group('🔄 Step 5: Unflattening FormData by File');
  
  const fileGroups: Record<string, Record<string, any>> = {};
  let fieldsProcessed = 0;
  
  // Group fields by file path
  Object.entries(flatFormData).forEach(([fieldPath, value]) => {
    const [filePath, ...keyParts] = fieldPath.split('/');
    const key = keyParts.join('/'); // Rejoin in case there were multiple slashes
    
    if (!fileGroups[filePath]) {
      fileGroups[filePath] = {};
      console.log(`📁 Created file group: ${filePath}`);
    }
    
    fileGroups[filePath][key] = value;
    fieldsProcessed++;
    console.log(`➡️ Grouped "${fieldPath}" → "${filePath}" / "${key}":`, 
      typeof value === 'object' ? '[Object/Array]' : `"${value}"`);
  });
  
  console.log(`📊 Grouped ${fieldsProcessed} fields into ${Object.keys(fileGroups).length} files`);
  
  // Unflatten each file's data using the flat library
  const unflattenedFiles: Record<string, Record<string, any>> = {};
  
  Object.entries(fileGroups).forEach(([filePath, flatData]) => {
    console.group(`🔧 Unflattening file: ${filePath}`);
    
    try {
      // Use flat library to unflatten nested keys (e.g., "params.author" → { params: { author: "..." } })
      const unflattened = unflatten(flatData, { 
        delimiter: '.', 
        safe: true 
      }) as Record<string, any>;
      
      unflattenedFiles[filePath] = unflattened;
      
      console.log(`✅ Unflattened ${Object.keys(flatData).length} flat keys → ${Object.keys(unflattened).length} nested keys`);
      console.log('📋 Top-level keys:', Object.keys(unflattened));
      
    } catch (error) {
      console.error(`❌ Error unflattening ${filePath}:`, error);
      // Fallback: keep flat structure
      unflattenedFiles[filePath] = flatData;
    }
    
    console.groupEnd();
  });
  
  console.log(`✨ Unflattening complete! Processed ${Object.keys(unflattenedFiles).length} files`);
  console.log('📁 Files ready for TOML/YAML conversion:', Object.keys(unflattenedFiles));
  console.groupEnd();
  
  return unflattenedFiles;
};

/**
 * Step 6: Convert unflattened nested structure back to TOML/YAML strings
 * Takes the nested objects and converts them back to config file format.
 */
export const convertToConfigStrings = (
  unflattenedByFile: Record<string, Record<string, any>>
): Record<string, string> => {
  console.group('📝 Step 6: Converting to Config Strings');
  
  const configStrings: Record<string, string> = {};
  let filesProcessed = 0;
  
  Object.entries(unflattenedByFile).forEach(([filePath, configData]) => {
    console.group(`🔧 Converting file: ${filePath}`);
    
    try {
      const extension = filePath.split('.').pop()?.toLowerCase();
      console.log('File extension:', extension);
      
      let configString = '';
      
      switch (extension) {
        case 'toml':
          console.log('Converting to TOML...');
          configString = stringifyTOML(configData);
          console.log('✅ TOML conversion successful');
          break;
          
        case 'yaml':
        case 'yml':
          console.log('Converting to YAML...');
          // For YAML, we'll use gray-matter to stringify
          configString = matter.stringify('', configData);
          // Remove the frontmatter delimiters since we want pure YAML
          configString = configString.replace(/^---\n/, '').replace(/\n---\n$/, '');
          console.log('✅ YAML conversion successful');
          break;
          
        case 'json':
          console.log('Converting to JSON...');
          configString = JSON.stringify(configData, null, 2);
          console.log('✅ JSON conversion successful');
          break;
          
        default:
          console.warn(`⚠️ Unknown file extension: ${extension}, defaulting to TOML`);
          configString = stringifyTOML(configData);
      }
      
      configStrings[filePath] = configString;
      filesProcessed++;
      
      console.log(`📄 Generated config string (${configString.length} chars)`);
      console.log('🔍 Full config content for copy/paste:');
      console.log('--- START CONFIG ---');
      console.log(configString);
      console.log('--- END CONFIG ---');
      
    } catch (error) {
      console.error(`❌ Error converting ${filePath}:`, error);
      // Fallback: JSON stringify
      configStrings[filePath] = JSON.stringify(configData, null, 2);
      console.log('🔄 Used JSON fallback');
    }
    
    console.groupEnd();
  });
  
  console.log(`✨ Config conversion complete! Processed ${filesProcessed} files`);
  console.log('📁 Generated config files:', Object.keys(configStrings));
  console.groupEnd();
  
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
  console.group('💾 Step 7: Saving Config Strings to GitHub');
  
  try {
    // Convert config strings to the format expected by the Convex action
    const configFiles = Object.entries(configStrings).map(([filePath, content]) => ({
      content,
      path: filePath,
      name: filePath.split('/').pop() || filePath,
      isDirectory: false
    }));
    
    console.log(`📤 Preparing to save ${configFiles.length} config files:`);
    configFiles.forEach(file => {
      console.log(`  📄 ${file.path} (${file.content.length} chars)`);
    });
    
    // Call the Convex action to save multiple config files
    await convexAction({
      id: documentId,
      configFiles
    });
    
    console.log('✅ Successfully saved all config files to GitHub!');
    console.log('🚀 Site will be automatically published via CI/CD');
    
  } catch (error) {
    console.error('❌ Failed to save config files:', error);
    throw new Error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  console.groupEnd();
};

/**
 * Step 2: Parse raw config files into formData with file path prefixes
 * Takes ConfigFile[] and returns flat object with "filepath/key" structure
 */
export const parseConfigsToFormData = (configFiles: ConfigFile[]): Record<string, any> => {
  console.group('🔧 Step 2: Parsing Configs to FormData');
  console.log('Input config files:', configFiles.length);

  const formData: Record<string, any> = {};

  configFiles.forEach((file, index) => {
    console.group(`📄 Processing File ${index + 1}: ${file.path}`);

    try {
      console.log('Raw content preview:', file.content.substring(0, 100) + '...');

      let configData: Record<string, any> = {};

      // Determine file type and parse accordingly
      const extension = file.path.split('.').pop()?.toLowerCase();
      console.log('File extension:', extension);

      switch (extension) {
        case 'toml':
          console.log('Parsing as TOML...');
          configData = parseTOML(file.content);
          break;

        case 'yaml':
        case 'yml':
          console.log('Parsing as YAML...');
          // For YAML, we can use gray-matter with proper frontmatter format
          const yamlWithFrontmatter = `---\n${file.content}\n---\n`;
          const parsed = matter(yamlWithFrontmatter);
          configData = parsed.data;
          break;

        case 'json':
          console.log('Parsing as JSON...');
          configData = JSON.parse(file.content);
          break;

        default:
          console.warn(`Unknown file extension: ${extension}, attempting TOML parse...`);
          configData = parseTOML(file.content);
      }

      console.log('Parsed data:', configData);
      console.log('Number of top-level keys:', Object.keys(configData).length);

      // Prepend file path to each top-level key
      Object.entries(configData).forEach(([key, value]) => {
        const prefixedKey = `${file.path}/${key}`;
        formData[prefixedKey] = value;
        console.log(`✅ Mapped: "${key}" → "${prefixedKey}"`, typeof value === 'object' ? '[Object/Array]' : value);
      });

    } catch (error) {
      console.error(`❌ Error parsing ${file.path}:`, error);
      console.log('File content that failed to parse:', file.content);
    }

    console.groupEnd();
  });

  console.log('🎯 Final FormData Structure:');
  console.log(formData);
  console.log('Total FormData keys:', Object.keys(formData).length);
  console.groupEnd();

  return formData;
};