// Interface for Hugo frontmatter metadata
export interface HugoFrontmatter {
  // Common Hugo frontmatter fields
  title: string;
  date?: string;
  draft?: boolean;
  description?: string;
  featured_image?: string;
  tags?: string[];
  categories?: string[];
  
  // SEO-related fields
  keywords?: string[];
  author?: string;
  
  // Layout-related fields
  layout?: string;
  type?: string;
  
  // Menu configuration
  menu?: {
    main?: {
      weight?: number;
      parent?: string;
    };
  };
  
  // Allow for additional custom fields with proper typing
  [key: string]: string | string[] | boolean | number | { [key: string]: unknown } | undefined;
}

// Base interface for file content
export interface FileContent {
  path: string;
  content: string;
  sha?: string;
}

// Interface for a complete Hugo content file
export interface HugoContent extends FileContent {
  metadata: HugoFrontmatter;
}

// Interface for the file tree structure
export interface HugoFileNode {
  name: string;
  path: string;
  type: 'tree' | 'blob';
  sha?: string;
  children?: HugoFileNode[];
} 