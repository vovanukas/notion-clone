"use client";

import { use, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSettings, useTemplateSchema } from "@/hooks/use-settings";
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

    const { 
        formData,
        updateFormData
    } = useSettings();

    // Fetch template schema from database
    const template = useTemplateSchema(document?.theme);

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

    // Simplified form handlers
    const handleFormChange = (data: any) => {
        if (data.formData) updateFormData(data.formData);
    };
    const handleFormSubmit = (data: any) => {
        if (data.formData) console.log("Form submitted:", data.formData);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <ThemeProvider theme={muiDarkTheme}>
                <Form
                    schema={template.settingsJsonSchema}
                    uiSchema={template.settingsUiSchema || {}}
                    formData={formData}
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