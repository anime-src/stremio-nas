import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { ApiError } from './error-handler';
import config from '../config';

// Extend Express Request interface to include validated fields
declare global {
  namespace Express {
    interface Request {
      validatedExt?: string;
      validatedFileId?: number;
      validatedImdbId?: string;
      validatedName?: string;
      validatedFilename?: string;
      validatedFilePath?: string;
      rangeRequest?: { start: number; end: number } | null;
    }
  }
}

/**
 * Validate file extension query parameter
 */
export function validateExtension(req: Request, _res: Response, next: NextFunction): void {
  const { ext } = req.query;
  
  if (!ext || typeof ext !== 'string') {
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
export function validateFileId(req: Request, _res: Response, next: NextFunction): void {
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
export function validateImdbId(req: Request, _res: Response, next: NextFunction): void {
  const { imdb_id } = req.query;
  
  if (!imdb_id || typeof imdb_id !== 'string') {
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
export function validateFileName(req: Request, _res: Response, next: NextFunction): void {
  const { name } = req.query;
  
  if (!name || typeof name !== 'string') {
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
export function validateFilePath(req: Request, _res: Response, next: NextFunction): void {
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
export function validateRange(fileSize: number) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const range = req.headers.range;
    
    if (!range || typeof range !== 'string') {
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
      (error as any).rangeInfo = { fileSize, requestedRange: range };
      throw error;
    }

    req.rangeRequest = { start, end };
    next();
  };
}
