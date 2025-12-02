import { create } from "zustand";
import { HugoFileNode } from "@/types/hugo";

export type GitHubList = {
  path: string;
  type: 'tree' | 'blob';
  sha: string;
};

type AppSidebarStore = {
  items: GitHubList[];
  treeData: HugoFileNode[];
  isLoading: boolean;
  error: string | null;

  // Track expanded folder paths (using path as stable identifier)
  expandedPaths: Set<string>;
  collapsedPaths: Set<string>; // Track explicitly collapsed paths (overrides soft expand)

  setItems: (items: GitHubList[]) => void;
  getNodeByPath: (path: string) => HugoFileNode | undefined;
  buildTree: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetSidebarState: () => void;

  // Expanded state management
  toggleExpanded: (path: string, currentlyExpanded: boolean) => void;
  setExpanded: (path: string, expanded: boolean) => void;
  isExpanded: (path: string) => boolean;
  isCollapsed: (path: string) => boolean;
};

export const useAppSidebar = create<AppSidebarStore>((set, get) => ({
  items: [],
  treeData: [],
  isLoading: false,
  error: null,
  expandedPaths: new Set(),
  collapsedPaths: new Set(),

  setItems: (items) => {
    set({ items });
    get().buildTree();
  },

  getNodeByPath: (path) => {
    const findNode = (nodes: HugoFileNode[], path: string): HugoFileNode | undefined => {
      for (const node of nodes) {
        if (node.path === path) {
          return node;
        }
        if (node.children) {
          const found = findNode(node.children, path);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };

    return findNode(get().treeData, path);
  },

  buildTree: () => {
    const { items } = get();
    const root: HugoFileNode[] = [];

    const sortedItems = [...items].sort((a, b) => a.path.localeCompare(b.path));
    const nodeMap: Record<string, HugoFileNode> = {};

    sortedItems.forEach((item) => {
      const pathParts = item.path.split("/");
      const name = pathParts[pathParts.length - 1];

      const node: HugoFileNode = {
        name,
        path: item.path,
        type: item.type,
        children: [],
        sha: item.sha,
      };

      nodeMap[item.path] = node;
    });

    sortedItems.forEach((item) => {
      const pathParts = item.path.split("/");

      if (pathParts.length === 1) {
        root.push(nodeMap[item.path]);
      } else {
        const parentPath = pathParts.slice(0, -1).join("/");
        const parentNode = nodeMap[parentPath];

        if (parentNode && parentNode.children) {
          parentNode.children.push(nodeMap[item.path]);
        }
      }
    });

    set({ treeData: root });
  },

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  resetSidebarState: () =>
    set({
      items: [],
      treeData: [],
      isLoading: false,
      error: null,
      expandedPaths: new Set(),
      collapsedPaths: new Set(),
    }),

  toggleExpanded: (path, currentlyExpanded) => {
    get().setExpanded(path, !currentlyExpanded);
  },

  setExpanded: (path, expanded) => {
    const { expandedPaths, collapsedPaths } = get();
    const newExpanded = new Set(expandedPaths);
    const newCollapsed = new Set(collapsedPaths);

    if (expanded) {
      newExpanded.add(path);
      newCollapsed.delete(path);
    } else {
      newExpanded.delete(path);
      newCollapsed.add(path);
    }
    set({ expandedPaths: newExpanded, collapsedPaths: newCollapsed });
  },

  isExpanded: (path) => get().expandedPaths.has(path),
  isCollapsed: (path) => get().collapsedPaths.has(path),
}));
