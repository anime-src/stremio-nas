import { Router } from 'express';
import filesRoutes from './files.routes';
import streamRoutes from './stream.routes';
import watchFoldersRoutes from './watch-folders.routes';
import settingsRoutes from './settings.routes';

/**
 * Main router - aggregates all route modules
 */

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Returns the health status of the API server
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 *             example:
 *               status: ok
 *               timestamp: "2024-01-01T00:00:00.000Z"
 */
router.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// Mount route modules - all under /api prefix for consistency
router.use('/api/files', filesRoutes);
router.use('/api/stream', streamRoutes);
router.use('/api/watch-folders', watchFoldersRoutes);
router.use('/api/settings', settingsRoutes);

export default router;
