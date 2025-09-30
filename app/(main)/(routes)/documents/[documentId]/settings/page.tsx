"use client";

import { use, useEffect, useRef, useState } from "react";
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

    // Only need currentSection for sidebar navigation
    const { currentSection } = useSettings();

    // Fetch template schema from database
    const template = useTemplateSchema(document?.theme);

    // Config processing pipeline
    const { fetchAndLogConfigs } = useConfigFetcher();
    const configFetchedRef = useRef<string | null>(null);
    
    // Pipeline state: Raw config → Flat data → Enriched (categorized) data → RJSF form
    const [flatFormData, setFlatFormData] = useState<Record<string, any> | null>(null);
    const [enrichedFormData, setEnrichedFormData] = useState<Record<string, any> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // Convex action for saving to GitHub
    const saveToGitHub = useAction(api.github.parseAndSaveMultipleConfigFiles);

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
            
            console.log('🎉 Deferred Step 3 completed successfully!');
            console.log('📋 Final Enriched FormData Structure:');
            console.log(enriched);
        }
    }, [template?.settingsJsonSchema, flatFormData, enrichedFormData]);

    // Handle scrolling to section based on hash when schema loads
    useEffect(() => {
        if (!template?.settingsJsonSchema) return;
        
        const hash = window.location.hash.slice(1);
        if (hash) {
            setTimeout(() => {
                const element = window.document.getElementById(`root_${hash}__title`);
                if (element) {
                    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({ top: elementPosition - 100, behavior: 'smooth' });
                }
            }, 200);
        }
    }, [template?.settingsJsonSchema]);

    // Show loading skeleton while waiting for data
    if (!document || document.buildStatus !== "BUILT" || !template) {
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

    // Don't render form if no schema available
    if (!template.settingsJsonSchema) {
        return null;
    }

    // Form event handlers
    const handleFormChange = (data: any) => {
        // RJSF handles form state internally - no external state updates needed
        console.log('📝 Form changed:', Object.keys(data.formData || {}).length, 'fields');
    };
    
    const handleFormSubmit = async (data: any) => {
        if (data.formData && template?.settingsJsonSchema && document?._id) {
            setIsSaving(true);
            
            try {
                console.log("🚀 Form submitted - processing through pipeline...");
                console.log("📥 Raw form data:", data.formData);
                
                // Step 3.5: Inject schema defaults for empty/undefined fields
                const formDataWithDefaults = injectSchemaDefaults(data.formData, template.settingsJsonSchema);
                
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
                
            } catch (error) {
                console.error("❌ Failed to save settings:", error);
                // You could add a toast notification here
            } finally {
                setIsSaving(false);
            }
        } else {
            console.warn("⚠️ Form submission missing data, schema, or document ID");
        }
    };

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
                >
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Saving Settings...
                            </>
                        ) : (
                            'Save Settings'
                        )}
                    </button>
                </Form>
            </ThemeProvider>
        </div>
    );
};

export default SettingsPage;