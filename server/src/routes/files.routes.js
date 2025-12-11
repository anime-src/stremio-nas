const express = require('express');
const router = express.Router();
const filesController = require('../controllers/files.controller');
const { validateExtension } = require('../middleware/validators');

/**
 * File listing routes
 */

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
 *     description: Retrieve a list of all video files with metadata from the database
 *     parameters:
 *       - in: query
 *         name: ext
 *         schema:
 *           type: string
 *           example: .mkv
 *         description: Optional filter by file extension (e.g., .mp4, .mkv)
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
 *         description: Invalid extension parameter
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
router.get('/', validateExtension, (req, res, next) => {
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
router.get('/stats', (req, res, next) => {
  filesController.getStats(req, res, next);
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
router.get('/scan-history', (req, res, next) => {
  filesController.getScanHistory(req, res, next);
});

module.exports = router;

