import { HugoFileNode } from "@/types/hugo";

export interface PageNode {
  id: string;
  title: string;
  path: string; // The structural path (folder path for nested pages, file path for leaves)
  contentPath?: string; // The actual path to the markdown content file (e.g. includes /_index.md)
  type: 'page' | 'folder';
  children: PageNode[];
  isIndex: boolean; // True if this is a folder acting as a page (has _index.md/index.md)
  originalNode: HugoFileNode;
}

/**
 * Checks if a file is an index file (Hugo branch or leaf bundle)
 */
export function isIndexFile(fileName: string): boolean {
  return fileName === '_index.md' || fileName === 'index.md';
}

/**
 * Formats a file/folder name into a readable title
 */
export function formatTitle(name: string): string {
  return name
    .replace(/\.md$/, '')           // Remove .md extension
    .replace(/^_?index$/, 'Home Page') // Handle index files as Home Page
    .replace(/[-_]/g, ' ')          // Replace hyphens/underscores with spaces
    .replace(/\b\w/g, c => c.toUpperCase()) // Title case
    .trim();
}

/**
 * Transforms a raw Hugo file tree into a Notion-like Page tree.
 * 
 * Logic:
 * 1. Folders with _index.md or index.md are treated as "Pages" with children.
 * 2. The index file itself is hidden from children (it represents the parent).
 * 3. Regular .md files are leaf "Pages".
 * 4. Everything is normalized to a PageNode structure.
 */
export function transformToPageTree(nodes: HugoFileNode[]): PageNode[] {
  if (!nodes) return [];

  const pageNodes: PageNode[] = [];

  for (const node of nodes) {
    // 1. Handle Folders (Tree)
    if (node.type === 'tree') {
      const children = node.children || [];
      
      // Find if this folder has an index file
      const indexFile = children.find(c => isIndexFile(c.name));
      
      // Recursively transform children
      // We exclude the index file from the visible children list because it IS the current page
      const visibleChildren = children.filter(c => !isIndexFile(c.name));
      const transformedChildren = transformToPageTree(visibleChildren);

      // Determine title: use index file's name if it exists (though it's usually _index.md), 
      // or fallback to folder name
      let title = node.name;
      if (title === 'content') continue; // Skip root content folder if it appears? (Usually handled by caller)

      // Special case: if this is the root content folder or has _index as name
      if (title === '_index' || title === 'index') {
        title = 'Home Page';
      } else {
        title = formatTitle(title);
      }

      pageNodes.push({
        id: node.sha || node.path,
        title,
        path: node.path,
        contentPath: indexFile ? `${node.path}/${indexFile.name}` : undefined,
        type: 'page', // In Notion model, everything is a page. Folders are just pages with children.
        children: transformedChildren,
        isIndex: !!indexFile,
        originalNode: node
      });
    } 
    // 2. Handle Files (Blob)
    else if (node.type === 'blob') {
      // Skip index files if they appear at this level (they should be handled by parent folder, 
      // but if they are at root or loose, we might need to handle them)
      if (isIndexFile(node.name)) {
        // If it's a root _index.md, it might be the Home Page
        if (node.path === 'content/_index.md' || node.name === '_index.md') {
           pageNodes.push({
            id: node.sha || node.path,
            title: 'Home Page',
            path: node.path,
            contentPath: node.path,
            type: 'page',
            children: [],
            isIndex: true,
            originalNode: node
          });
        }
        continue; 
      }

      // Only include markdown files
      if (!node.name.endsWith('.md')) continue;

      pageNodes.push({
        id: node.sha || node.path,
        title: formatTitle(node.name),
        path: node.path,
        contentPath: node.path,
        type: 'page',
        children: [],
        isIndex: false,
        originalNode: node
      });
    }
  }

  // Sort nodes: Folders/Index pages first, then files? Or alphabetical?
  // Notion usually sorts alphabetically mixing types, or custom.
  // Let's stick to alphabetical by title for now.
  return pageNodes.sort((a, b) => {
    // Home Page always first
    if (a.title === 'Home Page') return -1;
    if (b.title === 'Home Page') return 1;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Flattens the page tree into a map for easy lookup by path
 */
export function buildPageMap(nodes: PageNode[]): Map<string, PageNode> {
  const map = new Map<string, PageNode>();
  
  function traverse(node: PageNode) {
    map.set(node.path, node);
    // Also map by ID if needed
    node.children.forEach(traverse);
  }
  
  nodes.forEach(traverse);
  return map;
}

