import { create } from "zustand";
import yaml from "js-yaml";
import matter from "gray-matter";
import { Id } from "@/convex/_generated/dataModel";
import { findImageKey, getAllKeys } from "@/lib/utils";

// Comprehensive markdown preprocessing and normalization
const preprocessMarkdown = (markdown: string): string => {
  return markdown
    // Handle all combinations of bullet points and task lists
    // Using [*-] to match either * or - as list markers
    // First, normalize all list items to have single line breaks
    .replace(/(\n[*-] [^\n]+)\n\n([*-] )/g, '$1\n$2')
    // Then specifically handle task list items
    .replace(/(\n[*-] \[[x ]\][^\n]+)\n\n([*-] )/g, '$1\n$2')
    // Handle transition from bullet to task list
    .replace(/(\n[*-] [^\n]+)\n\n([*-] \[[x ]\])/g, '$1\n$2')
    // Handle transition from task list to bullet
    .replace(/(\n[*-] \[[x ]\][^\n]+)\n\n([*-] [^[])/g, '$1\n$2')
    // Normalize all list markers to - for consistency
    .replace(/\n\* /g, '\n- ')
    .trim();
};

// Normalize markdown content to handle editor-specific changes that aren't real edits
const normalizeMarkdown = (markdown: string): string => {
  return preprocessMarkdown(markdown)
    .trim();
};

type DocumentFrontmatter = {
  raw: string;  // Original YAML string
  parsed: Record<string, any>;  // Parsed object for app usage
};

type Document = {
  path: string;  // File path in the repo
  documentId: Id<"documents">;  // Convex document ID
  markdown: string;  // Content without frontmatter
  frontmatter: DocumentFrontmatter;
  sha: string | null;  // GitHub SHA
  isEdited: boolean;  // Track if document has unsaved changes
  isLoading?: boolean;

  imageKey?: string | null;  // Track which frontmatter field contains the image
};

type DocumentStore = {
  // State
  documents: Map<string, Document>;
  
  // Document operations
  loadDocument: (documentId: Id<"documents">, path: string, content: string) => void;
  unloadDocument: (path: string) => void;
  
  // Content operations
  updateMarkdown: (path: string, markdown: string) => void;
  updateFrontmatterRaw: (path: string, raw: string) => void;
  updateFrontmatterParsed: (path: string, data: Record<string, any>) => void;
  
  // Queries
  getDocument: (path: string) => Document | undefined;
  getEditedDocuments: () => Document[];
  hasUnsavedChanges: () => boolean;
  
  // GitHub operations
  prepareForGithub: (path: string) => { path: string; content: string } | undefined;
  prepareAllForGithub: () => Array<{ path: string; content: string }>;
  unloadAllDocuments: () => void;
  markAllSaved: () => void;
  debug: () => void;
};

export const useDocument = create<DocumentStore>((set, get) => ({
  documents: new Map(),

  loadDocument: (documentId, path, content) => {
    try {
      // Parse the document content
      const { data, content: markdown } = matter(content);
      
      // Convert frontmatter back to YAML for editing
      const raw = Object.keys(data).length > 0 ? yaml.dump(data, {
        lineWidth: -1,  // Disable line wrapping
        noRefs: true,   // Disable references
        quotingType: '"', // Use double quotes for strings
        forceQuotes: false // Don't force quotes for simple strings
      }) : '';

      // Find image key in frontmatter
      const imageKey = findImageKey(data);

      set(state => {
        const newDocs = new Map(state.documents);
        // Store both the original markdown and editor-ready version
        const normalizedMarkdown = normalizeMarkdown(markdown);
        newDocs.set(path, {
          path,
          documentId,
          markdown: normalizedMarkdown,
          frontmatter: {
            raw,
            parsed: data
          },
          sha: null,
          isEdited: false,
          imageKey
        });
        return { documents: newDocs };
      });
    } catch (err) {
      console.error(`Failed to load document ${path}:`, err);
      set(state => {
        const newDocs = new Map(state.documents);
        newDocs.set(path, {
          path,
          documentId,
          markdown: normalizeMarkdown(content),  // Normalize even error content
          frontmatter: {
            raw: "",
            parsed: {}
          },
          sha: null,
          isEdited: false,
          imageKey: null
        });
        return { documents: newDocs };
      });
    }
  },

  unloadDocument: (path) => {
    set(state => {
      const newDocs = new Map(state.documents);
      newDocs.delete(path);
      return { documents: newDocs };
    });
  },

  updateMarkdown: (path, markdown) => {
    set(state => {
      const doc = state.documents.get(path);
      if (!doc) return state;

      // Normalize both the new markdown and the stored markdown for comparison
      const normalizedNewMarkdown = normalizeMarkdown(markdown);
      const normalizedStoredMarkdown = normalizeMarkdown(doc.markdown);
      
      // Only mark as edited if the normalized content actually changed
      const hasActualChange = normalizedNewMarkdown !== normalizedStoredMarkdown;

      const newDocs = new Map(state.documents);
      newDocs.set(path, {
        ...doc,
        markdown: normalizedNewMarkdown,
        isEdited: doc.isEdited || hasActualChange
      });
      return { documents: newDocs };
    });
  },

  updateFrontmatterRaw: (path, raw) => {
    set(state => {
      const doc = state.documents.get(path);
      if (!doc) return state;

      const newDocs = new Map(state.documents);

      try {
        // Parse the raw YAML
        const parsed = yaml.load(raw) as Record<string, any>;
        const imageKey = findImageKey(parsed);

        newDocs.set(path, {
          ...doc,
          frontmatter: {
            raw,
            parsed
          },
          isEdited: true,
          imageKey
        });
      } catch {
        // On error, just update the raw value and keep existing parsed data
        newDocs.set(path, {
          ...doc,
          frontmatter: {
            ...doc.frontmatter,
            raw
          },
          isEdited: true
        });
      }

      return { documents: newDocs };
    });
  },

  updateFrontmatterParsed: (path, parsed) => {
    set(state => {
      const doc = state.documents.get(path);
      if (!doc) return state;

      try {
        // Convert to YAML with proper formatting options
        const raw = yaml.dump(parsed, {
          lineWidth: -1,  // Disable line wrapping
          noRefs: true,   // Disable references
          quotingType: '"', // Use double quotes for strings
          forceQuotes: false // Don't force quotes for simple strings
        });
        
        // Find image key in new frontmatter
        const imageKey = findImageKey(parsed);

        const newDocs = new Map(state.documents);
        newDocs.set(path, {
          ...doc,
          frontmatter: {
            raw,
            parsed
          },
          isEdited: true,
          imageKey
        });
        return { documents: newDocs };
      } catch {
        // Keep the parsed value but mark as error
        const newDocs = new Map(state.documents);
        newDocs.set(path, {
          ...doc,
          frontmatter: {
            ...doc.frontmatter,
            parsed
          },
          imageKey: doc.imageKey // Keep existing imageKey on error
        });
        return { documents: newDocs };
      }
    });
  },

  getDocument: (path) => get().documents.get(path),
  
  getEditedDocuments: () => 
    Array.from(get().documents.values()).filter(doc => doc.isEdited),

  hasUnsavedChanges: () => 
    Array.from(get().documents.values()).some(doc => doc.isEdited),

  unloadAllDocuments: () => {
    const docs = Array.from(get().documents.keys());
    docs.forEach(path => {
      set(state => {
        const newDocs = new Map(state.documents);
        newDocs.delete(path);
        return { documents: newDocs };
      });
    });
  },

  prepareAllForGithub: () => {
    const editedDocs = get().getEditedDocuments();
    return editedDocs
      .map(doc => {
        const prepared = get().prepareForGithub(doc.path);
        return prepared || null;
      })
      .filter((file): file is NonNullable<typeof file> => file !== null);
  },

  markAllSaved: () => {
    set(state => {
      const newDocs = new Map(state.documents);
      for (const [path, doc] of newDocs) {
        if (doc.isEdited) {
          newDocs.set(path, { ...doc, isEdited: false });
        }
      }
      return { documents: newDocs };
    });
  },

  prepareForGithub: (path) => {
    const doc = get().documents.get(path);
    if (!doc) return undefined;

    // If there's frontmatter, wrap it in --- delimiters
    const frontmatterSection = doc.frontmatter.raw 
      ? `---\n${doc.frontmatter.raw.trim()}\n---\n`
      : '';

    return {
      path,
      content: frontmatterSection + doc.markdown
    };
  },

  // Debug helper
  debug: () => {
    const state = get();
    console.group('🗂 Document Store State');
    console.log('Documents:', Array.from(state.documents.entries()).map(([path, doc]) => ({
      path,
      isEdited: doc.isEdited,
      frontmatterKeys: getAllKeys(doc.frontmatter.parsed),
      markdownPreview: doc.markdown,
      frontmatterRaw: doc.frontmatter.raw
    })));
    console.groupEnd();
  }
}));

// Export the preprocessing functions for use in other components
export { preprocessMarkdown, normalizeMarkdown };
