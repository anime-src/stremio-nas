import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  statusCode: number;
  details: any;

  constructor(statusCode: number, message: string, details: any = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Error handling middleware
 */
export function errorHandler(err: Error | ApiError, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    logger.warn('API Error', { 
      path: req.path, 
      statusCode: err.statusCode, 
      message: err.message,
      details: err.details
    });
    
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details })
    });
    return;
  }

  // Handle specific error types
  const nodeError = err as NodeJS.ErrnoException;
  if (nodeError.code === 'ENOENT') {
    logger.error('Resource not found', { path: req.path, error: err.message });
    res.status(404).json({ 
      error: 'Resource not found',
      message: err.message
    });
    return;
  }

  if (nodeError.code === 'EACCES') {
    logger.error('Permission denied', { path: req.path, error: err.message });
    res.status(403).json({ 
      error: 'Access denied',
      message: err.message
    });
    return;
  }

  // Generic error
  logger.error('Unhandled error', { 
    path: req.path, 
    error: err.message, 
    stack: err.stack 
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
}
