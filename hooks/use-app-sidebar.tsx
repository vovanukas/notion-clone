import { create } from "zustand";

interface GitHubList {
    path: string;
    mode?: string;
    type?: string;
    sha?: string;
    size?: number;
    url?: string;
}

interface TreeNode {
  name?: string;
  path?: string;
  type?: string;
  children?: TreeNode[];
  sha?: string;
}

type AppSidebarStore = {
  items: GitHubList[];
  treeData: TreeNode[];
  isLoading: boolean;
  error: string | null;

  setItems: (items: GitHubList[]) => void;
  getNodeByPath: (path: string) => TreeNode | undefined;
  buildTree: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetSidebarState: () => void;
};

export const useAppSidebar = create<AppSidebarStore>((set, get) => ({
  items: [],
  treeData: [],
  isLoading: false,
  error: null,

  setItems: (items: GitHubList[]) => {
    set({ items });
    get().buildTree();
  },

  getNodeByPath: (path: string) => {
    const findNode = (nodes: TreeNode[], path: string): TreeNode | undefined => {
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
    const root: TreeNode[] = [];

    const sortedItems = [...items].sort((a, b) => a.path.localeCompare(b.path));
    const nodeMap: Record<string, TreeNode> = {};

    sortedItems.forEach((item) => {
      const pathParts = item.path.split("/");
      const name = pathParts[pathParts.length - 1];

      const node: TreeNode = {
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

  setIsLoading: (isLoading: boolean) => set({ isLoading }),

  setError: (error: string | null) => set({ error }),

  resetSidebarState: () =>
    set({
      items: [],
      treeData: [],
      isLoading: false,
      error: null,
    }),
}));