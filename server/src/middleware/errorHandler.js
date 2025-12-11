const logger = require('../config/logger');

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    logger.warn('API Error', { 
      path: req.path, 
      statusCode: err.statusCode, 
      message: err.message,
      details: err.details
    });
    
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details })
    });
  }

  // Handle specific error types
  if (err.code === 'ENOENT') {
    logger.error('Resource not found', { path: req.path, error: err.message });
    return res.status(404).json({ 
      error: 'Resource not found',
      message: err.message
    });
  }

  if (err.code === 'EACCES') {
    logger.error('Permission denied', { path: req.path, error: err.message });
    return res.status(403).json({ 
      error: 'Access denied',
      message: err.message
    });
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

module.exports = {
  errorHandler,
  ApiError
};

