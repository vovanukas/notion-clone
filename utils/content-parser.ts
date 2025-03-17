/**
 * Utility to parse GitHub API content structure into a hierarchical tree
 * This version handles multiple levels of nesting recursively
 */
export function parseGitHubContent(items: any[]) {
  // Create a map of paths to their corresponding nodes
  const pathMap: Record<string, any[]> = {}

  // First, create all folder nodes
  items.forEach((item) => {
    const path = item.path

    if (item.type === "tree" || path.indexOf("/") === -1) {
      // This is a folder or top-level item
      const parts = path.split("/")
      const name = parts[parts.length - 1]

      // Create a node for this folder if it doesn't exist
      if (!pathMap[path]) {
        pathMap[path] = [name]
      }
    }
  })

  // Then add all files to their parent folders
  items.forEach((item) => {
    const path = item.path

    if (item.type === "blob") {
      // This is a file
      const parts = path.split("/")
      const fileName = parts[parts.length - 1]
      const parentPath = parts.slice(0, -1).join("/")

      // Add to parent folder if it exists
      if (parentPath && pathMap[parentPath]) {
        pathMap[parentPath].push(fileName)
      } else if (parts.length === 2) {
        // This is a file directly under a top-level folder
        const topFolder = parts[0]
        if (pathMap[topFolder]) {
          pathMap[topFolder].push(fileName)
        }
      }
    }
  })

  // Now build the folder hierarchy
  const tree: any[] = []

  // Helper function to recursively build the tree
  function buildTree(folderPath: string): any[] | null {
    const folder = pathMap[folderPath]
    if (!folder) return null

    // Start with the folder name
    const result = [folder[0]]

    // Add all direct children
    for (const item of items) {
      const itemPath = item.path
      const parts = itemPath.split("/")

      if (item.type === "blob") {
        // This is a file
        const parentPath = parts.slice(0, -1).join("/")
        if (parentPath === folderPath) {
          // This file is directly under this folder
          result.push(parts[parts.length - 1])
        }
      } else if (item.type === "tree") {
        // This is a subfolder
        const parentPath = parts.slice(0, -1).join("/")
        if (parentPath === folderPath) {
          // This folder is directly under this folder
          const subTree = buildTree(itemPath)
          if (subTree) {
            result.push(subTree)
          }
        }
      }
    }

    return result
  }

  // Add top-level folders to the tree
  for (const item of items) {
    if (item.path.indexOf("/") === -1) {
      // This is a top-level item
      if (item.type === "tree") {
        const folderTree = buildTree(item.path)
        if (folderTree) {
          tree.push(folderTree)
        }
      }
    }
  }

  return { tree }
}