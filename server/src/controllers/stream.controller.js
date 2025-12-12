const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const { ApiError } = require('../middleware/errorHandler');
const { getMimeType, getFileStats } = require('../utils/fileUtils');
const db = require('../services/database.service');
const config = require('../config');

// Simple in-memory cache for file stats (avoids repeated fs.stat calls)
// Uses Map for O(1) lookups, with TTL-based expiration
const statsCache = new Map();
const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get file stats with caching
 */
async function getCachedFileStats(filePath) {
  const now = Date.now();
  const cached = statsCache.get(filePath);
  
  if (cached && (now - cached.timestamp) < STATS_CACHE_TTL) {
    return cached.stats;
  }
  
  const stats = await getFileStats(filePath);
  statsCache.set(filePath, { stats, timestamp: now });
  
  // Cleanup old entries (lazy cleanup on access)
  if (statsCache.size > 1000) {
    const entries = Array.from(statsCache.entries());
    entries.forEach(([key, value]) => {
      if ((now - value.timestamp) >= STATS_CACHE_TTL) {
        statsCache.delete(key);
      }
    });
  }
  
  return stats;
}

/**
 * Controller for video streaming operations
 */
class StreamController {
  /**
   * Get file metadata without streaming content (HEAD request)
   * @route HEAD /stream/:id
   */
  async getFileMetadata(req, res, next) {
    const fileId = req.validatedFileId;
    
    logger.debug('Metadata request', { fileId });
    
    try {
      // Lookup file by ID
      const file = db.getFileById(fileId);
      
      if (!file) {
        logger.warn('File not found', { fileId });
        return next(new ApiError(404, 'File not found'));
      }
      
      // Construct full file path from relative path
      const filePath = path.join(config.mediaDir, file.path);
      
      // Get file stats (cached for performance)
      const stats = await getCachedFileStats(filePath);
      const contentType = getMimeType(filePath);
      
      // Set headers (same as GET but no body)
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Last-Modified', new Date(stats.mtime).toUTCString());
      res.setHeader('ETag', `"${stats.size}-${stats.mtime}"`);
      
      res.status(200).end();
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.warn('File not found', { fileId });
        return next(new ApiError(404, 'File not found'));
      }
      
      logger.error('Error accessing file metadata', { 
        fileId, 
        error: err.message 
      });
      next(err);
    }
  }

  /**
   * Stream video file with Range support
   * @route GET /stream/:id
   */
  async streamFile(req, res, next) {
    const startTime = Date.now();
    const fileId = req.validatedFileId;
    
    logger.info('Stream request', { fileId, range: req.headers.range });
    
    try {
      // Lookup file by ID
      const file = db.getFileById(fileId);
      
      if (!file) {
        logger.warn('File not found', { fileId });
        return next(new ApiError(404, 'File not found'));
      }
      
      // Construct full file path from relative path
      const filePath = path.join(config.mediaDir, file.path);
      const filename = file.name;
      
      // Get file stats (cached for performance)
      const stats = await getCachedFileStats(filePath);
      const contentType = getMimeType(filePath);
      
      // Parse Range header
      const range = req.headers.range;
      
      if (!range) {
        // No range requested, send entire file
        return this._streamFullFile(res, filePath, stats, contentType, filename, startTime);
      }
      
      // Stream partial content
      return this._streamPartialFile(res, filePath, stats, contentType, range, filename, startTime);
      
    } catch (err) {
      const duration = Date.now() - startTime;
      
      if (err.code === 'ENOENT') {
        logger.warn('File not found', { filename, filePath, duration: `${duration}ms` });
        return next(new ApiError(404, 'File not found'));
      }
      
      logger.error('Error accessing file', { 
        filename, 
        filePath, 
        error: err.message, 
        duration: `${duration}ms` 
      });
      next(err);
    }
  }

  /**
   * Stream entire file
   * @private
   */
  _streamFullFile(res, filePath, stats, contentType, filename, startTime) {
    logger.debug('Streaming entire file', { filename, size: stats.size, contentType });
    
    // Set caching headers for better seeking performance
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Last-Modified', new Date(stats.mtime).toUTCString());
    res.setHeader('ETag', `"${stats.size}-${stats.mtime}"`);
    
    // Larger buffer for better throughput (8x default)
    const stream = fs.createReadStream(filePath, {
      highWaterMark: 512 * 1024 // 512 KB buffer
    });
    stream.pipe(res);
    
    stream.on('error', (err) => {
      const duration = Date.now() - startTime;
      logger.error('Stream error', { filename, error: err.message, duration: `${duration}ms` });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      }
    });
    
    stream.on('end', () => {
      const duration = Date.now() - startTime;
      logger.info('Stream completed', { filename, size: stats.size, duration: `${duration}ms` });
    });
  }

  /**
   * Stream partial file with Range support
   * @private
   */
  _streamPartialFile(res, filePath, stats, contentType, rangeHeader, filename, startTime) {
    // Parse Range header (e.g., "bytes=0-1023" or "bytes=1024-")
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
    const chunksize = (end - start) + 1;
    
    // Validate range
    if (start >= stats.size || end >= stats.size || start > end) {
      logger.warn('Range not satisfiable', { filename, range: rangeHeader, fileSize: stats.size });
      res.status(416).setHeader('Content-Range', `bytes */${stats.size}`);
      return res.json({ error: 'Range not satisfiable' });
    }
    
    // Set headers for partial content
    logger.debug('Streaming partial content', { 
      filename, 
      range: `${start}-${end}`, 
      chunksize, 
      contentType 
    });
    
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunksize);
    res.setHeader('Content-Type', contentType);
    // Caching headers for better seeking performance
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Last-Modified', new Date(stats.mtime).toUTCString());
    res.setHeader('ETag', `"${stats.size}-${stats.mtime}"`);
    
    // Create read stream with range and larger buffer for better throughput
    const stream = fs.createReadStream(filePath, { 
      start, 
      end,
      highWaterMark: 512 * 1024 // 512 KB buffer (8x default)
    });
    stream.pipe(res);
    
    stream.on('error', (err) => {
      const duration = Date.now() - startTime;
      logger.error('Stream error', { 
        filename, 
        range: `${start}-${end}`, 
        error: err.message, 
        duration: `${duration}ms` 
      });
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      }
    });
    
    stream.on('end', () => {
      const duration = Date.now() - startTime;
      logger.info('Partial stream completed', { 
        filename, 
        range: `${start}-${end}`, 
        chunksize, 
        duration: `${duration}ms` 
      });
    });
  }
}

module.exports = new StreamController();

