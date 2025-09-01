import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isImagePath(path: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];
  return imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
}

export function findImageKey(changedFile: { [key: string]: any } | null) {
  if (!changedFile) return null;

  // Look through all properties for an image path
  for (const [key, value] of Object.entries(changedFile)) {
    if (typeof value === 'string' && isImagePath(value)) {
      return key;
    }
  }
  return null;
}
