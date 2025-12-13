import { Router } from 'express';
import streamController from '../controllers/stream.controller';
import { validateFileId } from '../middleware/validators';

/**
 * Video streaming routes
 */

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Streaming
 *   description: Video file streaming operations
 */

/**
 * @swagger
 * /stream/{id}:
 *   head:
 *     summary: Get file metadata
 *     tags: [Streaming]
 *     description: Get file metadata without downloading content (fast metadata query for players)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: File ID from database
 *     responses:
 *       200:
 *         description: File metadata (no body, headers only)
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *             description: MIME type of the video file
 *           Content-Length:
 *             schema:
 *               type: integer
 *             description: File size in bytes
 *           Accept-Ranges:
 *             schema:
 *               type: string
 *             description: Supported range unit (bytes)
 *           Cache-Control:
 *             schema:
 *               type: string
 *             description: Caching directives
 *           Last-Modified:
 *             schema:
 *               type: string
 *             description: Last modification time
 *           ETag:
 *             schema:
 *               type: string
 *             description: Entity tag for caching
 *       404:
 *         description: File not found
 *   get:
 *     summary: Stream video file
 *     tags: [Streaming]
 *     description: Stream a video file with Range header support for seeking. Uses file ID from database.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: File ID from database
 *       - in: header
 *         name: Range
 *         schema:
 *           type: string
 *           example: bytes=0-1023
 *         description: Optional Range header for partial content requests (e.g., "bytes=0-1023" or "bytes=1024-")
 *     responses:
 *       200:
 *         description: Full file stream
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *           video/x-matroska:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *             description: MIME type of the video file
 *           Content-Length:
 *             schema:
 *               type: integer
 *             description: File size in bytes
 *           Accept-Ranges:
 *             schema:
 *               type: string
 *             description: Supported range unit (bytes)
 *       206:
 *         description: Partial content stream
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Range:
 *             schema:
 *               type: string
 *             description: Range of bytes being returned (e.g., "bytes 0-1023/1048576")
 *           Content-Length:
 *             schema:
 *               type: integer
 *             description: Size of the partial content in bytes
 *       400:
 *         description: Invalid Range header format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Access denied (path traversal attempt blocked)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       416:
 *         description: Range not satisfiable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// HEAD request for metadata (fast, no body transfer)
router.head('/:id', validateFileId, (req, res, next) => {
  streamController.getFileMetadata(req, res, next);
});

// GET request for streaming
router.get('/:id', validateFileId, (req, res, next) => {
  streamController.streamFile(req, res, next);
});

export default router;
