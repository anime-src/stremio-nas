const path = require('path');
const { ApiError } = require('./errorHandler');
const config = require('../config');

/**
 * Validate file extension query parameter
 */
function validateExtension(req, res, next) {
  const { ext } = req.query;
  
  if (!ext) {
    return next();
  }

  const normalizedExt = ext.toLowerCase().startsWith('.') 
    ? ext.toLowerCase() 
    : `.${ext.toLowerCase()}`;

  if (!config.allowedExtensions.includes(normalizedExt)) {
    throw new ApiError(400, 'Invalid file extension', {
      provided: ext,
      allowed: config.allowedExtensions
    });
  }

  req.validatedExt = normalizedExt;
  next();
}

/**
 * Validate file ID parameter
 */
function validateFileId(req, res, next) {
  const fileId = parseInt(req.params.id, 10);
  
  if (!fileId || isNaN(fileId) || fileId <= 0) {
    throw new ApiError(400, 'Invalid file ID');
  }

  // Store validated ID in request
  req.validatedFileId = fileId;
  
  next();
}

/**
 * Validate IMDB ID query parameter
 */
function validateImdbId(req, res, next) {
  const { imdb_id } = req.query;
  
  if (!imdb_id) {
    return next();
  }

  // IMDB IDs should start with 'tt' followed by digits
  if (!/^tt\d+$/.test(imdb_id)) {
    throw new ApiError(400, 'Invalid IMDB ID format', {
      provided: imdb_id,
      expected: 'tt followed by digits (e.g., tt1234567)'
    });
  }

  req.validatedImdbId = imdb_id;
  next();
}

/**
 * Validate filename query parameter
 */
function validateFileName(req, res, next) {
  const { name } = req.query;
  
  if (!name) {
    return next();
  }

  // Basic validation: min length and no null bytes
  if (name.length < 2) {
    throw new ApiError(400, 'Filename search must be at least 2 characters', {
      provided: name.length,
      minimum: 2
    });
  }

  if (name.includes('\0')) {
    throw new ApiError(400, 'Invalid filename: null bytes not allowed');
  }

  req.validatedName = name;
  next();
}

/**
 * Validate and sanitize file path parameter (deprecated - kept for backward compatibility)
 */
function validateFilePath(req, res, next) {
  const filename = decodeURIComponent(req.params[0] || req.params.filename || '');
  
  if (!filename) {
    throw new ApiError(400, 'Filename is required');
  }

  // Basic validation
  if (filename.includes('\0')) {
    throw new ApiError(400, 'Invalid filename');
  }

  // Security: prevent directory traversal
  const filePath = path.join(config.mediaDir, filename);
  const resolvedPath = path.resolve(filePath);
  const resolvedMediaDir = path.resolve(config.mediaDir);
  
  if (!resolvedPath.startsWith(resolvedMediaDir)) {
    throw new ApiError(403, 'Access denied', {
      reason: 'Path traversal attempt blocked'
    });
  }

  // Store validated values in request
  req.validatedFilename = filename;
  req.validatedFilePath = resolvedPath;
  
  next();
}

/**
 * Validate Range header
 */
function validateRange(fileSize) {
  return (req, res, next) => {
    const range = req.headers.range;
    
    if (!range) {
      req.rangeRequest = null;
      return next();
    }

    // Parse Range header (e.g., "bytes=0-1023" or "bytes=1024-")
    const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
    
    if (!rangeMatch) {
      throw new ApiError(400, 'Invalid Range header format');
    }

    const start = parseInt(rangeMatch[1], 10);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

    // Validate range
    if (start >= fileSize || end >= fileSize || start > end || start < 0) {
      const error = new ApiError(416, 'Range not satisfiable');
      error.rangeInfo = { fileSize, requestedRange: range };
      throw error;
    }

    req.rangeRequest = { start, end };
    next();
  };
}

module.exports = {
  validateExtension,
  validateFileId,
  validateImdbId,
  validateFileName,
  validateFilePath,
  validateRange
};

