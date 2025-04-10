import { create } from "zustand";
import { HugoFileNode } from "@/types/hugo";

type GitHubList = {
  path: string;
  type: 'tree' | 'blob';
  sha: string;
};

type AppSidebarStore = {
  items: GitHubList[];
  treeData: HugoFileNode[];
  isLoading: boolean;
  error: string | null;

  setItems: (items: GitHubList[]) => void;
  getNodeByPath: (path: string) => HugoFileNode | undefined;
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
    }),
}));