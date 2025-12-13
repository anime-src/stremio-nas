import { promises as fs } from 'fs';
import mime from 'mime-types';

/**
 * File utility functions
 * Pure, stateless utility functions for file operations
 */

/**
 * Get file statistics
 * @param filePath - Path to file
 * @returns File stats
 */
export async function getFileStats(filePath: string): Promise<import('fs').Stats> {
  return await fs.stat(filePath);
}

/**
 * Get MIME type for file
 * @param filePath - Path to file
 * @returns MIME type
 */
export function getMimeType(filePath: string): string {
  return mime.lookup(filePath) || 'application/octet-stream';
}

/**
 * Check if file exists
 * @param filePath - Path to file
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format file size in human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted size
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
