import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isImagePath(path: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];
  return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
}

// Recursively extract all keys from a nested object
export function getAllKeys(obj: { [key: string]: any } | null | undefined, prefix: string = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];

  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.push(fullKey);

    // If the value is an object (but not an array), recursively get its keys
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    }
  }

  return keys;
}

// Get a nested value from an object using dot notation
export function getNestedValue(obj: { [key: string]: any } | null | undefined, key: string): any {
  if (!obj || !key) return undefined;

  // If the key doesn't contain dots, it's a simple property access
  if (!key.includes('.')) {
    return obj[key];
  }

  // Split the key by dots and traverse the object
  const keys = key.split('.');
  let current = obj;

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return undefined;
    }
  }

  return current;
}

// Recursively find an image key in nested objects
export function findImageKey(changedFile: { [key: string]: any } | null | undefined): string | null {
  if (!changedFile) return null;

  // Helper function to recursively search for image paths
  function searchForImageKey(obj: { [key: string]: any }, prefix: string = ''): string | null {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string' && isImagePath(value)) {
        return fullKey;
      }

      // If the value is an object (but not an array), recursively search it
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedResult = searchForImageKey(value, fullKey);
        if (nestedResult) return nestedResult;
      }
    }
    return null;
  }

  return searchForImageKey(changedFile);
}
