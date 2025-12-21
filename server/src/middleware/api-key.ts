import { Request, Response, NextFunction } from 'express';
import { ApiError } from './error-handler';
import config from '../config';

/**
 * API key authentication middleware
 * Validates the X-API-Key header against the configured API key
 * If no API key is configured, authentication is skipped (optional mode)
 */
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  // Skip authentication if API key is not configured
  if (!config.apiKey) {
    return next();
  }

  // Get API key from header
  const apiKey = req.get('X-API-Key');

  // Check if API key is provided
  if (!apiKey) {
    throw new ApiError(401, 'API key required', {
      message: 'Missing X-API-Key header'
    });
  }

  // Validate API key
  if (apiKey !== config.apiKey) {
    throw new ApiError(401, 'Invalid API key', {
      message: 'The provided API key is invalid'
    });
  }

  // API key is valid, proceed
  next();
}

