const express = require('express');
const router = express.Router();
const filesRoutes = require('./files.routes');
const streamRoutes = require('./stream.routes');

/**
 * Main router - aggregates all route modules
 */

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
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// Mount route modules
router.use('/files', filesRoutes);
router.use('/stream', streamRoutes);

module.exports = router;

