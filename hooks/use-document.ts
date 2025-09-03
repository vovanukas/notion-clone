import { create } from "zustand";
import yaml from "js-yaml";
import matter from "gray-matter";
import { Id } from "@/convex/_generated/dataModel";
import { findImageKey } from "@/lib/utils";

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
      const raw = Object.keys(data).length > 0 ? yaml.dump(data) : '';

      // Find image key in frontmatter
      const imageKey = findImageKey(data);

      set(state => {
        const newDocs = new Map(state.documents);
        newDocs.set(path, {
          path,
          documentId,
          markdown: markdown.trim(),
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
          markdown: content,  // Store original content on error
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

      // Normalize markdown content
      const normalizedMarkdown = markdown.trim();
      
      // Only mark as edited if content actually changed
      const isEdited = normalizedMarkdown !== doc.markdown;

      const newDocs = new Map(state.documents);
      newDocs.set(path, {
        ...doc,
        markdown: normalizedMarkdown,
        isEdited: doc.isEdited || isEdited
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
        // Convert to YAML
        const raw = yaml.dump(parsed);
        
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
      } catch (err) {
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
      ? `---\n${doc.frontmatter.raw}---\n` 
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
      frontmatterKeys: Object.keys(doc.frontmatter.parsed),
      markdownPreview: doc.markdown,
      frontmatterRaw: doc.frontmatter.raw
    })));
    console.groupEnd();
  }
}));
