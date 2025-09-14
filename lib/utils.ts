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

// Set a nested value in an object using dot notation
export function setNestedValue(obj: { [key: string]: any }, key: string, value: any): { [key: string]: any } {
  if (!key) return obj;

  // If the key doesn't contain dots, it's a simple property assignment
  if (!key.includes('.')) {
    return { ...obj, [key]: value };
  }

  // Split the key by dots and create nested structure
  const keys = key.split('.');
  const result = { ...obj };
  let current = result;

  // Navigate to the parent of the target property
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];

    // If the property doesn't exist or isn't an object, create it
    if (!current[k] || typeof current[k] !== 'object' || Array.isArray(current[k])) {
      current[k] = {};
    } else {
      // Clone the nested object to avoid mutation
      current[k] = { ...current[k] };
    }

    current = current[k];
  }

  // Set the final value
  const finalKey = keys[keys.length - 1];
  current[finalKey] = value;

  return result;
}

// Delete a nested value from an object using dot notation
export function deleteNestedValue(obj: { [key: string]: any }, key: string, clearValueOnly: boolean = false): { [key: string]: any } {
  if (!key) return obj;

  // If the key doesn't contain dots, it's a simple property operation
  if (!key.includes('.')) {
    const result = { ...obj };
    if (clearValueOnly) {
      result[key] = '';  // Set to empty string instead of deleting
    } else {
      delete result[key];
    }
    return result;
  }

  // Split the key by dots and navigate to the parent
  const keys = key.split('.');
  const result = { ...obj };
  let current = result;
  const parents: any[] = [result];

  // Navigate to the parent of the target property, keeping track of parents
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];

    if (!current[k] || typeof current[k] !== 'object' || Array.isArray(current[k])) {
      // Path doesn't exist, nothing to delete
      return obj;
    }

    // Clone the nested object to avoid mutation
    current[k] = { ...current[k] };
    current = current[k];
    parents.push(current);
  }

  // Delete or clear the final property
  const finalKey = keys[keys.length - 1];
  if (clearValueOnly) {
    current[finalKey] = '';  // Set to empty string instead of deleting
  } else {
    delete current[finalKey];

    // Clean up empty parent objects (only when completely deleting)
    for (let i = keys.length - 2; i >= 0; i--) {
      const parentKey = keys[i];
      const parent = parents[i];
      const child = parents[i + 1];

      // If the child object is now empty, remove it from parent
      if (Object.keys(child).length === 0) {
        delete parent[parentKey];
      } else {
        // Stop cleanup if we find a non-empty object
        break;
      }
    }
  }

  return result;
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

// Find the best image key to use - either an existing empty one or suggest a new one
export function findBestImageKey(frontmatter: { [key: string]: any } | null | undefined): { key: string; isExisting: boolean } {
  if (!frontmatter) return { key: 'image', isExisting: false };

  // Common image key patterns to look for
  const imageKeyPatterns = [
    'featured_image', 'cover_image', 'cover', 'image',
    'hero_image', 'thumbnail', 'banner', 'photo', 'picture'
  ];

  // Helper function to recursively search for empty image keys
  function searchForEmptyImageKey(obj: { [key: string]: any }, prefix: string = ''): string | null {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const lowerKey = key.toLowerCase();

      // Check if this is an image-related key that's empty
      if ((imageKeyPatterns.some(pattern => lowerKey.includes(pattern.toLowerCase())) ||
           lowerKey.includes('image') || lowerKey.includes('cover') || lowerKey.includes('banner')) &&
          (typeof value === 'string' && (!value || value.trim() === ''))) {
        return fullKey;
      }

      // If the value is an object (but not an array), recursively search it
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedResult = searchForEmptyImageKey(value, fullKey);
        if (nestedResult) return nestedResult;
      }
    }
    return null;
  }

  // First, try to find an existing empty image key
  const existingEmptyKey = searchForEmptyImageKey(frontmatter);
  if (existingEmptyKey) {
    return { key: existingEmptyKey, isExisting: true };
  }

  // If no empty image key exists, suggest creating a simple 'image' key
  // This is the most generic and widely supported option
  return { key: 'image', isExisting: false };
}
