const fs = require('fs').promises;
const mime = require('mime-types');

/**
 * File utility functions
 */

/**
 * Get file statistics
 * @param {string} filePath - Path to file
 * @returns {Promise<Object>} File stats
 */
async function getFileStats(filePath) {
  return await fs.stat(filePath);
}

/**
 * Get MIME type for file
 * @param {string} filePath - Path to file
 * @returns {string} MIME type
 */
function getMimeType(filePath) {
  return mime.lookup(filePath) || 'application/octet-stream';
}

/**
 * Check if file exists
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

module.exports = {
  getFileStats,
  getMimeType,
  fileExists,
  formatFileSize
};

