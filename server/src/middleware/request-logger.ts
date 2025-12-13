import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Request logging middleware
 */
export default function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Log incoming request
  logger.debug('Incoming request', { 
    method: req.method, 
    path: req.path, 
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Capture response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    return originalSend.call(this, data);
  };

  next();
}
