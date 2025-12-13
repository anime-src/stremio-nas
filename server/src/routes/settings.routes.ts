import { Router } from 'express';
import settingsController from '../controllers/settings.controller';

/**
 * Server settings routes
 */

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: Server settings management
 */

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get all server settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Server settings
 */
router.get('/', (req, res, next) => {
  settingsController.getAllSettings(req, res, next);
});

/**
 * @swagger
 * /api/settings/{key}:
 *   get:
 *     summary: Get a specific setting
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Setting value
 *       404:
 *         description: Setting not found
 */
router.get('/:key', (req, res, next) => {
  settingsController.getSetting(req, res, next);
});

/**
 * @swagger
 * /api/settings/{key}:
 *   put:
 *     summary: Update a server setting
 *     tags: [Settings]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting updated
 */
router.put('/:key', (req, res, next) => {
  settingsController.updateSetting(req, res, next);
});

/**
 * @swagger
 * /api/settings:
 *   post:
 *     summary: Bulk update server settings
 *     tags: [Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.post('/', (req, res, next) => {
  settingsController.bulkUpdateSettings(req, res, next);
});

export default router;
