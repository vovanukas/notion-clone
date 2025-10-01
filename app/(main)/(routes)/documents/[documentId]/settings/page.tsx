"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSettings, useTemplateSchema, useConfigFetcher, enrichFormDataWithCategories, injectSchemaDefaults, removeCategoriesFromFormData, unflattenFormDataByFile, convertToConfigStrings, saveConfigStringsToGitHub } from "@/hooks/use-settings";
import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Skeleton } from "@/components/ui/skeleton";

// MUI dark theme configuration
const muiDarkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#3b82f6' },
        background: { default: 'transparent', paper: 'rgba(255, 255, 255, 0.05)' },
        text: { primary: 'rgba(255, 255, 255, 0.95)', secondary: 'rgba(255, 255, 255, 0.7)' },
    },
    typography: {
        h6: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' },
        body1: { fontSize: '0.875rem' },
        caption: { fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' },
    },
    components: {
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.4)' },
                        '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
                    },
                },
            },
        },
        MuiFormLabel: {
            styleOverrides: {
                root: { fontSize: '0.875rem', fontWeight: 500 },
            },
        },
    },
});

interface SettingsPageProps {
    params: Promise<{
        documentId: Id<"documents">;
    }>;
}

const SettingsPage = ({ params }: SettingsPageProps) => {
    const { documentId } = use(params);
    
    const document = useQuery(api.documents.getById, {
        documentId: documentId
    });

    // Settings state management
    const { 
        currentSection, 
        setCurrentSection,
        setOriginalFormData,
        setCurrentFormData,
        setSaveFunction,
        setIsSaving
    } = useSettings();

    // Fetch template schema from database
    const template = useTemplateSchema(document?.theme);

    // Config processing pipeline
    const { fetchAndLogConfigs } = useConfigFetcher();
    const configFetchedRef = useRef<string | null>(null);
    
    // Pipeline state: Raw config → Flat data → Enriched (categorized) data → RJSF form
    const [flatFormData, setFlatFormData] = useState<Record<string, any> | null>(null);
    const [enrichedFormData, setEnrichedFormData] = useState<Record<string, any> | null>(null);
    
    // Convex action for saving to GitHub
    const saveToGitHub = useAction(api.github.parseAndSaveMultipleConfigFiles);

    // Create save function for navbar (must be before any conditional returns)
    const createSaveFunction = useCallback((formData: Record<string, any>) => {
        return async () => {
            if (formData && template?.settingsJsonSchema && document?._id) {
                setIsSaving(true);
                
                try {
                    console.log("🚀 Form submitted from navbar - processing through pipeline...");
                    console.log("📥 Raw form data:", formData);
                    
                    // Step 3.5: Inject schema defaults for empty/undefined fields
                    const formDataWithDefaults = injectSchemaDefaults(formData, template.settingsJsonSchema);
                    
                    console.log("📤 Form data with defaults applied:");
                    console.log(formDataWithDefaults);
                    
                    // Step 4: Remove categories and flatten back to simple key-value structure
                    const flatFormData = removeCategoriesFromFormData(formDataWithDefaults);
                    
                    console.log("🎯 Flat form data:");
                    console.log(flatFormData);
                    
                    // Step 5: Unflatten back to nested structure grouped by file
                    const unflattenedByFile = unflattenFormDataByFile(flatFormData);
                    
                    console.log("🏗️ Unflattened structure:");
                    console.log(unflattenedByFile);
                    
                    // Step 6: Convert to TOML/YAML strings
                    const configStrings = convertToConfigStrings(unflattenedByFile);
                    
                    console.log("📝 Config strings ready for saving:");
                    console.log(configStrings);
                    
                    // Step 7: Save to GitHub
                    await saveConfigStringsToGitHub(configStrings, document._id, saveToGitHub);
                    
                    // Show summary of what was processed
                    const totalCategories = Object.keys(formDataWithDefaults).length;
                    const totalFields = Object.keys(flatFormData).length;
                    const totalFiles = Object.keys(unflattenedByFile).length;
                    const totalStrings = Object.keys(configStrings).length;
                    
                    console.log(`📊 Submission summary: ${totalCategories} categories → ${totalFields} flat fields → ${totalFiles} config files → ${totalStrings} config strings`);
                    console.log("🎉 Settings saved successfully!");
                    
                    // Reset change tracking
                    setOriginalFormData(formData);
                    
                } catch (error) {
                    console.error("❌ Failed to save settings:", error);
                    throw error; // Re-throw for toast handling
                } finally {
                    setIsSaving(false);
                }
            } else {
                console.warn("⚠️ Form submission missing data, schema, or document ID");
                throw new Error("Missing required data for saving settings");
            }
        };
    }, [template?.settingsJsonSchema, document?._id, saveToGitHub, setIsSaving, setOriginalFormData]);

    // Form event handlers
    const handleFormChange = (data: any) => {
        // Track form changes for navbar save button
        if (data.formData) {
            setCurrentFormData(data.formData);
            
            // Update save function with current form data
            const saveFunction = createSaveFunction(data.formData);
            setSaveFunction(saveFunction);
        }
        
        console.log('📝 Form changed:', Object.keys(data.formData || {}).length, 'fields');
    };
    
    const handleFormSubmit = async (data: any) => {
        // Form submission now handled by navbar save button
        // This is just a fallback if someone hits Enter in a form field
        const saveFunction = createSaveFunction(data.formData);
        if (saveFunction) {
            await saveFunction();
        }
    };

    // Config Processing Pipeline: Steps 1 → 2 → 2.5 → 3
    useEffect(() => {
        if (document?._id && document?.buildStatus === "BUILT") {
            // Only fetch if we haven't fetched for this document yet
            if (configFetchedRef.current !== document._id) {
                console.log('🚀 Starting config processing pipeline...');
                configFetchedRef.current = document._id;

                // Completely reset all state before starting
                console.log('🧹 Resetting all state before processing...');
                setFlatFormData(null);
                setEnrichedFormData(null);

                fetchAndLogConfigs(document._id)
                    .then(result => {
                        console.log('🎉 Steps 1 & 2 & 2.5 completed successfully!');
                        console.log('ConfigFiles:', result.configFiles);
                        console.log('Flattened FormData:', result.formData);

                        // Debug: Check if Step 2.5 output is contaminated
                        const step25HasCategories = Object.keys(result.formData).some(key =>
                            ['general', 'appearance', 'content', 'social', 'seo', 'multilingual', 'advanced', '_preserved'].includes(key)
                        );
                        console.log('🔍 Step 2.5 output contaminated with categories?', step25HasCategories);

                        // Step 3: Run enrichment immediately if schema is available
                        if (template?.settingsJsonSchema) {
                            console.log('🚀 Running Step 3: Schema available, enriching data...');
                            
                            const enriched = enrichFormDataWithCategories(result.formData, template.settingsJsonSchema);
                            setEnrichedFormData(enriched);
                            
                            // Store as original data for change tracking
                            setOriginalFormData(enriched);
                            
                            console.log('🎉 Step 3 completed successfully!');
                            console.log('📋 Final Enriched FormData Structure:');
                            console.log(enriched);
                        } else {
                            console.log('⏳ Step 3 deferred: Schema not yet available');
                            // Store flattened formData temporarily until schema loads
                            setFlatFormData(result.formData);
                        }
                    })
                    .catch(error => {
                        console.error('❌ Steps 1 & 2 failed:', error);
                    });
            }
        }
    }, [document?._id, document?.buildStatus, fetchAndLogConfigs]);

    // Handle case where schema loads after config data (deferred Step 3)
    useEffect(() => {
        if (!enrichedFormData && flatFormData && Object.keys(flatFormData).length > 0 && template?.settingsJsonSchema) {
            console.log('🚀 Running deferred Step 3: Schema just became available');
            
            const enriched = enrichFormDataWithCategories(flatFormData, template.settingsJsonSchema);
            setEnrichedFormData(enriched);
            
            // Store as original data for change tracking
            setOriginalFormData(enriched);
            
            console.log('🎉 Deferred Step 3 completed successfully!');
            console.log('📋 Final Enriched FormData Structure:');
            console.log(enriched);
        }
    }, [template?.settingsJsonSchema, flatFormData, enrichedFormData, setOriginalFormData]);

    // Sync currentSection with URL hash and handle scrolling
    useEffect(() => {
        if (!template?.settingsJsonSchema) return;
        
        const hash = window.location.hash.slice(1);
        
        // Update currentSection state to match URL hash
        if (hash) {
            setCurrentSection(hash);
            // Scroll to the section
            setTimeout(() => {
                const element = window.document.getElementById(`root_${hash}__title`);
                if (element) {
                    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({ top: elementPosition - 100, behavior: 'smooth' });
                }
            }, 200);
        } else {
            // No hash means "All Settings" view
            setCurrentSection(null);
        }
    }, [template?.settingsJsonSchema, setCurrentSection]);

    // Listen for hash changes to update currentSection
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            setCurrentSection(hash || null);
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [setCurrentSection]);

    // Show loading skeleton while waiting for data or enriched form data
    if (!document || document.buildStatus !== "BUILT" || !template || !enrichedFormData) {
        return (
            <div className="p-6 max-w-4xl mx-auto space-y-8">
                {/* Header skeleton */}
                <div className="space-y-4">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                
                {/* Form sections skeleton */}
                {[1, 2, 3, 4].map((section) => (
                    <div key={section} className="space-y-4">
                        <Skeleton className="h-6 w-48" />
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-36" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    </div>
                ))}
                
                {/* Submit button skeleton */}
                <div className="pt-4">
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <ThemeProvider theme={muiDarkTheme}>
                <Form
                    schema={template.settingsJsonSchema}
                    uiSchema={template.settingsUiSchema || {}}
                    formData={enrichedFormData}
                    validator={validator}
                    onChange={handleFormChange}
                    onSubmit={handleFormSubmit}
                    omitExtraData={false}
                    liveOmit={false}
                />
            </ThemeProvider>
        </div>
    );
};

export default SettingsPage;