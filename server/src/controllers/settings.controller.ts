import { Request, Response, NextFunction } from 'express';
import configService from '../services/config.service';
import logger from '../config/logger';
import { setLogLevel } from '../config/logger';

/**
 * Controller for server settings management
 */
class SettingsController {
  /**
   * Get all server settings
   * @route GET /api/settings
   */
  async getAllSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = configService.getSettings();
      res.json(settings);
    } catch (err: any) {
      logger.error('Error getting settings', { error: err.message });
      next(err);
    }
  }

  /**
   * Get a specific setting
   * @route GET /api/settings/:key
   */
  async getSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const value = configService.getSetting(key);
      
      if (value === null || value === undefined) {
        res.status(404).json({ error: 'Setting not found' });
        return;
      }

      res.json({ key, value });
    } catch (err: any) {
      logger.error('Error getting setting', { error: err.message });
      next(err);
    }
  }

  /**
   * Update a server setting
   * @route PUT /api/settings/:key
   */
  async updateSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined || value === null) {
        res.status(400).json({ error: 'Value is required' });
        return;
      }

      // Special handling for log level
      if (key === 'logLevel') {
        const validLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
        if (!validLevels.includes(value.toLowerCase())) {
          res.status(400).json({ 
            error: 'Invalid log level',
            validLevels 
          });
          return;
        }
        setLogLevel(value);
      }

      // Update setting
      await configService.setSetting(key, String(value));
      logger.info('Updated server setting', { key, value });

      res.json({ key, value });
    } catch (err: any) {
      logger.error('Error updating setting', { error: err.message });
      next(err);
    }
  }

  /**
   * Bulk update server settings
   * @route POST /api/settings
   */
  async bulkUpdateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings: Record<string, string> = req.body;

      if (!settings || typeof settings !== 'object') {
        res.status(400).json({ error: 'Settings object is required' });
        return;
      }

      // Special handling for log level
      if (settings.logLevel) {
        const validLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
        if (!validLevels.includes(settings.logLevel.toLowerCase())) {
          res.status(400).json({ 
            error: 'Invalid log level',
            validLevels 
          });
          return;
        }
        setLogLevel(settings.logLevel);
      }

      // Update all settings
      for (const [key, value] of Object.entries(settings)) {
        await configService.setSetting(key, String(value));
      }
      logger.info('Bulk updated server settings', { keys: Object.keys(settings) });

      res.json(settings);
    } catch (err: any) {
      logger.error('Error bulk updating settings', { error: err.message });
      next(err);
    }
  }
}

export default new SettingsController();
