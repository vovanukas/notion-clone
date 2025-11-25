"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSettings, useTemplateSchema, useConfigFetcher, enrichFormDataWithCategories, injectSchemaDefaults, removeCategoriesFromFormData, escapeSpecialCharsInKeys, unflattenFormDataByFile, convertToConfigStrings, saveConfigStringsToGitHub } from "@/hooks/use-settings";
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
                    // Step 3.5: Inject schema defaults for empty/undefined fields
                    const formDataWithDefaults = injectSchemaDefaults(formData, template.settingsJsonSchema);
                    
                    // Step 4: Remove categories and flatten back to simple key-value structure
                    const flatFormData = removeCategoriesFromFormData(formDataWithDefaults);
                    
                    // Step 4.5: Escape special characters to prevent flat library misinterpretation
                    const escapedFlatFormData = escapeSpecialCharsInKeys(flatFormData);
                    
                    // Step 5: Unflatten back to nested structure grouped by file
                    const unflattenedByFile = unflattenFormDataByFile(escapedFlatFormData);
                    
                    // Step 6: Convert to TOML/YAML strings
                    const configStrings = convertToConfigStrings(unflattenedByFile);
                    
                    // Step 7: Save to GitHub
                    await saveConfigStringsToGitHub(configStrings, document._id, saveToGitHub);
                    
                    // Reset change tracking
                    setOriginalFormData(formData);
                    
                } catch (error) {
                    console.error("Failed to save settings:", error);
                    throw error; // Re-throw for toast handling
                } finally {
                    setIsSaving(false);
                }
            } else {
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
                configFetchedRef.current = document._id;

                // Reset all state before starting
                setFlatFormData(null);
                setEnrichedFormData(null);

                fetchAndLogConfigs(document._id)
                    .then(result => {
                        // Step 3: Run enrichment immediately if schema is available
                        if (template?.settingsJsonSchema) {
                            const enriched = enrichFormDataWithCategories(result.formData, template.settingsJsonSchema);
                            setEnrichedFormData(enriched);
                            
                            // Store as original data for change tracking
                            setOriginalFormData(enriched);
                        } else {
                            // Store flattened formData temporarily until schema loads
                            setFlatFormData(result.formData);
                        }
                    })
                    .catch(error => {
                        console.error('Error in config processing:', error);
                    });
            }
        }
    }, [document?._id, document?.buildStatus, fetchAndLogConfigs, template?.settingsJsonSchema, setOriginalFormData]);

    // Handle case where schema loads after config data (deferred Step 3)
    useEffect(() => {
        if (!enrichedFormData && flatFormData && Object.keys(flatFormData).length > 0 && template?.settingsJsonSchema) {
            const enriched = enrichFormDataWithCategories(flatFormData, template.settingsJsonSchema);
            setEnrichedFormData(enriched);
            
            // Store as original data for change tracking
            setOriginalFormData(enriched);
        }
    }, [template?.settingsJsonSchema, flatFormData, enrichedFormData, setOriginalFormData]);

    // Sync currentSection with URL hash and handle scrolling
    useEffect(() => {
        if (!enrichedFormData) return;
        
        const hash = window.location.hash.slice(1);
        
        // Update currentSection state to match URL hash
        if (hash) {
            setCurrentSection(hash);
            // Scroll to the section after form is rendered
            setTimeout(() => {
                const element = window.document.getElementById(`root_${hash}__title`);
                if (element) {
                    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({ top: elementPosition - 100, behavior: 'smooth' });
                }
            }, 300); // Increased timeout to ensure form is fully rendered
        } else {
            // No hash means "All Settings" view
            setCurrentSection(null);
        }
    }, [enrichedFormData, setCurrentSection]);

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
                <div style={{ maxWidth: '100%', width: '100%', overflow: 'hidden' }}>
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
                </div>
            </ThemeProvider>
        </div>
    );
};

export default SettingsPage;