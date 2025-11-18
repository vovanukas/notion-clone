"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { usePageSettings } from "@/hooks/use-page-settings";
import { useParams } from "next/navigation";
import { useDocument } from "@/hooks/use-document";
import Editor from "@monaco-editor/react";
import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import { createTheme, ThemeProvider } from "@mui/material/styles";

// MUI dark theme configuration (reused from settings page)
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

// Simple hook to fetch page settings schema
const usePageSettingsSchema = (theme: string | undefined) => {
  console.log('🔧 Settings Modal - Theme:', theme);
  return useQuery(
    api.hugoTemplates.getPageSettingsSchema,
    theme ? { folderName: theme } : "skip"
  );
};

export const SettingsModal = () => {
  const pageSettings = usePageSettings();
  const params = useParams();

  const filePathParam = params.filePath as string[];
  const filePathString = filePathParam?.join('/') || '';
  const decodedPath = decodeURIComponent(filePathString);

  // Get document from store and Convex
  const { updateFrontmatterRaw, updateFrontmatterParsed } = useDocument();
  const currentDocument = useDocument(state => state.documents.get(decodedPath));

  // Get document by ID from Convex for theme detection (same pattern as settings page)
  const documentId = params.documentId as string;
  const document = useQuery(
    api.documents.getById,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip"
  );

  // Get theme from Convex document, fallback to theme from store document, or default to ananke
  const theme = document?.theme || currentDocument?.frontmatter.parsed?.theme || 'ananke';
  const pageSettingsSchema = usePageSettingsSchema(theme);

  // State for form data and view toggle
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showRawEditor, setShowRawEditor] = useState(false);

  // Get raw frontmatter for display
  const frontmatterString = currentDocument?.frontmatter.raw || '';

  // Initialize form data when document loads
  useEffect(() => {
    if (currentDocument?.frontmatter.parsed) {
      setFormData(currentDocument.frontmatter.parsed);
      console.log('🔧 Settings Modal - Form data from parsed frontmatter:', currentDocument.frontmatter.parsed);
    }
  }, [currentDocument]);

  // Determine if we should show the form (schema available) or raw editor only
  const hasSchema = pageSettingsSchema?.jsonSchema && Object.keys(pageSettingsSchema.jsonSchema).length > 0;
  const shouldShowFormToggle = hasSchema && Object.keys(formData).length > 0;

  // If no schema available, force raw editor view
  useEffect(() => {
    if (!hasSchema) {
      setShowRawEditor(true);
    }
  }, [hasSchema]);

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    updateFrontmatterRaw(decodedPath, value);
  };

  const handleFormChange = (data: any) => {
    if (data.formData) {
      setFormData(data.formData);
      // Update the parsed frontmatter in the document store
      updateFrontmatterParsed(decodedPath, data.formData);
    }
  };

  const handleFormSubmit = (data: any) => {
    // Form submission handled automatically by onChange
    console.log('🔧 Settings Modal - Form submitted:', data.formData);
  };

  return (
    <Dialog open={pageSettings.isOpen} onOpenChange={pageSettings.onClose}>
      <DialogContent className="w-[95vw] max-w-[900px] h-[90vh] max-h-[800px]">
        <DialogHeader>
          <DialogTitle>Page Settings</DialogTitle>
          <DialogDescription>
            {hasSchema
              ? "Edit your page settings using the form or raw editor. Changes are saved automatically."
              : "Edit your page frontmatter. No schema available for this theme - showing raw editor only."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid gap-4 py-4 overflow-hidden">
          {/* Toggle buttons - only show if schema is available */}
          {shouldShowFormToggle && (
            <div className="flex gap-2">
              <Button
                variant={!showRawEditor ? "default" : "outline"}
                size="sm"
                onClick={() => setShowRawEditor(false)}
              >
                Form View
              </Button>
              <Button
                variant={showRawEditor ? "default" : "outline"}
                size="sm"
                onClick={() => setShowRawEditor(true)}
              >
                Raw Editor
              </Button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto">
            {showRawEditor ? (
              // Raw Monaco Editor
              <Editor
                height="100%"
                defaultLanguage="yaml"
                language="yaml"
                value={frontmatterString}
                onChange={handleEditorChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                  fontSize: 12,
                }}
              />
            ) : (
              // RJSF Form View
              <div className="space-y-4">
                {Object.keys(formData).length > 0 && hasSchema ? (
                  <ThemeProvider theme={muiDarkTheme}>
                    <Form
                      schema={pageSettingsSchema.jsonSchema}
                      uiSchema={{
                        ...pageSettingsSchema.uiSchema,
                        "ui:submitButtonOptions": { norender: true }
                      }}
                      formData={formData}
                      validator={validator as any}
                      onChange={handleFormChange}
                      onSubmit={handleFormSubmit}
                      omitExtraData={false}
                      liveOmit={false}
                      showErrorList={false}
                    />
                  </ThemeProvider>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    {!currentDocument
                      ? "Loading document..."
                      : !hasSchema
                      ? "No schema available for this theme. Use the Raw Editor to edit frontmatter."
                      : "No frontmatter found. Add some frontmatter to your document to see form fields here."
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={pageSettings.onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};