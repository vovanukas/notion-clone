// Base interface for file content
export interface FileContent {
  path: string;
  content: string;
  sha?: string;
}

// Interface for a complete Hugo content file
export interface HugoContent extends FileContent {
  metadata: { [key: string]: unknown };
}

// Interface for the file tree structure
export interface HugoFileNode {
  name: string;
  path: string;
  type: 'tree' | 'blob';
  sha?: string;
  children?: HugoFileNode[];
} 