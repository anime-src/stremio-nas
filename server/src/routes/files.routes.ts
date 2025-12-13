import { Router } from 'express';
import filesController from '../controllers/files.controller';
import { validateExtension, validateImdbId, validateFileName } from '../middleware/validators';

/**
 * File listing routes
 */

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Files
 *   description: File listing and management operations
 */

/**
 * @swagger
 * /files:
 *   get:
 *     summary: List all video files
 *     tags: [Files]
 *     description: |
 *       Retrieve a list of all video files with metadata from the database.
 *       
 *       **Filter Priority (only one filter applies):**
 *       1. `imdb_id` - Exact match by IMDB ID (highest priority)
 *       2. `name` - Case-insensitive partial match in filename or parsed name
 *       3. `ext` - Filter by file extension
 *       4. No filter - Returns all files
 *     parameters:
 *       - in: query
 *         name: imdb_id
 *         schema:
 *           type: string
 *           example: tt1234567
 *         description: Filter by IMDB ID (exact match, e.g., tt1234567)
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *           example: Pose
 *         description: Search by filename (case-insensitive partial match, min 2 characters)
 *       - in: query
 *         name: ext
 *         schema:
 *           type: string
 *           example: .mkv
 *         description: Filter by file extension (e.g., .mp4, .mkv)
 *     responses:
 *       200:
 *         description: List of video files
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/File'
 *       400:
 *         description: Invalid parameter
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
router.get('/', validateExtension, validateImdbId, validateFileName, (req, res, next) => {
  filesController.listFiles(req, res, next);
});

/**
 * @swagger
 * /files/refresh:
 *   post:
 *     summary: Trigger manual file scan
 *     tags: [Files]
 *     description: Force a fresh scan of the filesystem and update the database
 *     responses:
 *       200:
 *         description: File scan completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScanResult'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/refresh', (req, res, next) => {
  filesController.refreshCache(req, res, next);
});

/**
 * @swagger
 * /files/stats:
 *   get:
 *     summary: Get database and scheduler statistics
 *     tags: [Files]
 *     description: Retrieve statistics about the database and scheduler status
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Stats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/stats', (req, res) => {
  filesController.getStats(req, res);
});

/**
 * @swagger
 * /files/scan-history:
 *   get:
 *     summary: Get scan history
 *     tags: [Files]
 *     description: Retrieve the history of file system scans
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of scan records to return
 *     responses:
 *       200:
 *         description: Scan history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScanHistory'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/scan-history', (req, res) => {
  filesController.getScanHistory(req, res);
});

export default router;
