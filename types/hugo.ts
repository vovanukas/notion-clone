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
  
  // Custom fields that might be specific to your theme
  menu?: {
    main?: {
      weight?: number;
      parent?: string;
    };
  };
  
  // Allow for additional custom fields
  [key: string]: any;
}

// Interface for a complete Hugo content file
export interface HugoContent {
  // The parsed frontmatter metadata
  metadata: HugoFrontmatter;
  
  // The actual content in markdown format
  content: string;
  
  // File information
  path: string;
  sha?: string;
}

// Interface for the file tree structure
export interface HugoFileNode {
  name: string;
  path: string;
  type: 'tree' | 'blob';
  sha?: string;
  children?: HugoFileNode[];
} 