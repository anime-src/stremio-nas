import { Router } from 'express';
import watchFoldersController from '../controllers/watch-folders.controller';

/**
 * Watch folders management routes
 */

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Watch Folders
 *   description: Watch folders management operations
 */

/**
 * @swagger
 * /api/watch-folders:
 *   get:
 *     summary: List all watch folders
 *     tags: [Watch Folders]
 *     responses:
 *       200:
 *         description: List of watch folders
 */
router.get('/', (req, res, next) => {
  watchFoldersController.listWatchFolders(req, res, next);
});

/**
 * @swagger
 * /api/watch-folders/{id}:
 *   get:
 *     summary: Get watch folder by ID
 *     tags: [Watch Folders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Watch folder details
 *       404:
 *         description: Watch folder not found
 */
router.get('/:id', (req, res, next) => {
  watchFoldersController.getWatchFolderById(req, res, next);
});

/**
 * @swagger
 * /api/watch-folders:
 *   post:
 *     summary: Create a new watch folder
 *     tags: [Watch Folders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - path
 *             properties:
 *               path:
 *                 type: string
 *               name:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               scan_interval:
 *                 type: string
 *               allowed_extensions:
 *                 type: array
 *                 items:
 *                   type: string
 *               min_video_size_mb:
 *                 type: integer
 *               temporary_extensions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Watch folder created
 *       400:
 *         description: Invalid input
 */
router.post('/', (req, res, next) => {
  watchFoldersController.createWatchFolder(req, res, next);
});

/**
 * @swagger
 * /api/watch-folders/{id}:
 *   put:
 *     summary: Update a watch folder
 *     tags: [Watch Folders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Watch folder updated
 *       404:
 *         description: Watch folder not found
 */
router.put('/:id', (req, res, next) => {
  watchFoldersController.updateWatchFolder(req, res, next);
});

/**
 * @swagger
 * /api/watch-folders/{id}:
 *   delete:
 *     summary: Delete a watch folder
 *     tags: [Watch Folders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Watch folder deleted
 *       404:
 *         description: Watch folder not found
 */
router.delete('/:id', (req, res, next) => {
  watchFoldersController.deleteWatchFolder(req, res, next);
});

/**
 * @swagger
 * /api/watch-folders/{id}/scan:
 *   post:
 *     summary: Trigger manual scan for a watch folder
 *     tags: [Watch Folders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Scan completed
 *       409:
 *         description: Scan already in progress
 */
router.post('/:id/scan', (req, res, next) => {
  watchFoldersController.triggerScan(req, res, next);
});

/**
 * @swagger
 * /api/watch-folders/{id}/stats:
 *   get:
 *     summary: Get scan statistics for a watch folder
 *     tags: [Watch Folders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Watch folder statistics
 */
router.get('/:id/stats', (req, res, next) => {
  watchFoldersController.getWatchFolderStats(req, res, next);
});

export default router;
