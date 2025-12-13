import path from 'path';

/**
 * Security utility functions
 */

/**
 * Validate that a path is within allowed directory
 * @param filePath - Path to validate
 * @param allowedDir - Allowed base directory
 * @returns True if path is safe
 */
export function isPathSafe(filePath: string, allowedDir: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowedDir = path.resolve(allowedDir);
  
  return resolvedPath.startsWith(resolvedAllowedDir);
}

/**
 * Sanitize filename by removing dangerous characters
 * @param filename - Filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._\-\/\\]/g, '_');
}

/**
 * Check if a string contains path traversal attempts
 * @param input - Input to check
 * @returns True if potentially dangerous
 */
export function hasPathTraversal(input: string): boolean {
  const dangerousPatterns = [
    /\.\./,           // Parent directory
    /\0/,             // Null byte
    /[<>:"|?*]/,      // Invalid Windows filename chars
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(input));
}
