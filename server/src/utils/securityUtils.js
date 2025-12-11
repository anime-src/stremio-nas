const path = require('path');

/**
 * Security utility functions
 */

/**
 * Validate that a path is within allowed directory
 * @param {string} filePath - Path to validate
 * @param {string} allowedDir - Allowed base directory
 * @returns {boolean} True if path is safe
 */
function isPathSafe(filePath, allowedDir) {
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowedDir = path.resolve(allowedDir);
  
  return resolvedPath.startsWith(resolvedAllowedDir);
}

/**
 * Sanitize filename by removing dangerous characters
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._\-\/\\]/g, '_');
}

/**
 * Check if a string contains path traversal attempts
 * @param {string} input - Input to check
 * @returns {boolean} True if potentially dangerous
 */
function hasPathTraversal(input) {
  const dangerousPatterns = [
    /\.\./,           // Parent directory
    /\0/,             // Null byte
    /[<>:"|?*]/,      // Invalid Windows filename chars
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(input));
}

module.exports = {
  isPathSafe,
  sanitizeFilename,
  hasPathTraversal
};

