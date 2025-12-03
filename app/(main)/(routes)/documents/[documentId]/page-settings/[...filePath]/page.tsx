"use client";

export const runtime = "edge";

import { use, useCallback, useEffect, useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useDocument } from "@/hooks/use-document";
import Form from "@rjsf/mui";
import validator from "@rjsf/validator-ajv8";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// MUI dark theme configuration (reused from site settings)
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
    filePath: string[];
  }>;
}

const SettingsPage = ({ params }: SettingsPageProps) => {
  const { documentId, filePath } = use(params);
  const router = useRouter();
  
  // Construct the file path string
  const filePathString = Array.isArray(filePath) ? filePath.join('/') : filePath;
  const decodedPath = decodeURIComponent(filePathString);

  // Get document metadata from Convex
  const document = useQuery(api.documents.getById, {
    documentId: documentId
  });

  // Get page settings schema based on theme
  const pageSettingsSchema = useQuery(
    api.hugoTemplates.getPageSettingsSchema,
    document?.theme ? { folderName: document.theme } : "skip"
  );

  // Get document from store
  const currentDocument = useDocument(state => state.documents.get(decodedPath));
  const { updateFrontmatterParsed, loadDocument, getDocument } = useDocument();

  // Convex action to fetch file content
  const fetchFileContent = useAction(api.github.fetchAndReturnGithubFileContent);

  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);

  // Load document if not already in store
  useEffect(() => {
    const loadContentIfNeeded = async () => {
      if (!documentId || !filePath) return;

      // Check if document is already loaded
      const existingDoc = getDocument(decodedPath);
      if (existingDoc) {
        console.log('📄 Document already loaded:', decodedPath);
        return;
      }

      // Load from server
      setIsLoadingDocument(true);
      try {
        const fileContent = await fetchFileContent({
          id: documentId,
          path: `content/${decodedPath}`,
        });

        // Load into document store
        loadDocument(documentId, decodedPath, fileContent);
        console.log('📄 Document loaded successfully:', decodedPath);
      } catch (err) {
        console.error("Failed to load document:", err);
        toast.error("Failed to load document");
      } finally {
        setIsLoadingDocument(false);
      }
    };

    loadContentIfNeeded();
  }, [documentId, filePath, decodedPath, fetchFileContent, loadDocument, getDocument]);

  // Initialize form data from current document's frontmatter
  useEffect(() => {
    if (currentDocument?.frontmatter.parsed) {
      setFormData(currentDocument.frontmatter.parsed);
      console.log('📋 Initialized form data:', currentDocument.frontmatter.parsed);
    }
  }, [currentDocument?.frontmatter.parsed]);

  // Handle form changes
  const handleFormChange = useCallback((data: any) => {
    if (data.formData) {
      setFormData(data.formData);
      
      // Update document store with new frontmatter
      updateFrontmatterParsed(decodedPath, data.formData);
      console.log('📝 Form data updated:', data.formData);
    }
  }, [decodedPath, updateFrontmatterParsed]);

  // Show loading state
  if (!document || !currentDocument || !pageSettingsSchema || isLoadingDocument) {
    return (
      <div className="h-full flex flex-col">
        {/* Header skeleton */}
        <div className="border-b p-4 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Form skeleton */}
        <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full space-y-8">
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
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasSchema = pageSettingsSchema?.jsonSchema && Object.keys(pageSettingsSchema.jsonSchema).length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 space-y-2">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Page Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure frontmatter settings for <span className="font-mono">{decodedPath}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
        {hasSchema ? (
          <ThemeProvider theme={muiDarkTheme}>
            <Form
              schema={pageSettingsSchema.jsonSchema || {}}
              uiSchema={{
                ...pageSettingsSchema.uiSchema,
                "ui:submitButtonOptions": { norender: true }
              }}
              formData={formData}
              validator={validator as any}
              onChange={handleFormChange}
              omitExtraData={false}
              liveOmit={false}
              showErrorList={false}
              experimental_defaultFormStateBehavior={{
                allOf: 'skipDefaults',
                emptyObjectFields: 'skipDefaults'
              }}
            />
          </ThemeProvider>
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium">No Settings Schema Available</p>
              <p className="text-sm mt-2">
                The theme <span className="font-mono">{document.theme}</span> doesn&apos;t have a page settings schema configured.
              </p>
              <p className="text-sm mt-4">
                You can still edit the frontmatter directly in the page editor.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;


