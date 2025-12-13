import db from './database.service';
import logger from '../config/logger';
import config from '../config';
import { WatchFolder } from '../types/watch-folder';

/**
 * Dynamic configuration service that loads settings from database
 */
class ConfigService {
  private watchFolders: WatchFolder[] = [];
  private serverSettings: Record<string, string> = {};
  private initialized: boolean = false;

  /**
   * Initialize configuration from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load watch folders
      this.watchFolders = db.getAllWatchFolders();
      logger.info('Loaded watch folders from database', { count: this.watchFolders.length });

      // Load server settings
      this.serverSettings = db.getAllSettings();
      logger.info('Loaded server settings from database', { count: Object.keys(this.serverSettings).length });

      // Initialize default settings if database is empty
      if (Object.keys(this.serverSettings).length === 0) {
        this._initializeDefaultSettings();
      }

      // Create default watch folder from env var if none exist
      if (this.watchFolders.length === 0 && config.mediaDir) {
        await this._createDefaultWatchFolder();
      }

      this.initialized = true;
    } catch (error: any) {
      logger.error('Failed to initialize configuration service', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize default server settings
   * @private
   */
  private _initializeDefaultSettings(): void {
    const defaults: Record<string, string> = {
      logLevel: config.logLevel || 'info',
      apiHost: config.apiHost || `http://localhost:${config.port}`,
      cacheImdbTTL: String(config.cache.imdbTTL || 86400000),
      cacheMaxSize: String(config.cache.maxSize || 1000),
      imdbEnabled: config.imdb.enabled !== false ? 'true' : 'false',
      scanOnStartup: config.scanner.onStartup !== false ? 'true' : 'false'
    };

    db.setSettings(defaults);
    this.serverSettings = { ...defaults };
    logger.info('Initialized default server settings');
  }

  /**
   * Create default watch folder from environment variable
   * @private
   */
  private async _createDefaultWatchFolder(): Promise<void> {
    try {
      const defaultFolder = db.createWatchFolder({
        path: config.mediaDir,
        name: 'Default Watch Folder',
        enabled: true,
        scan_interval: config.scanner.interval || '*/5 * * * *',
        allowed_extensions: config.allowedExtensions || ['.mp4', '.mkv', '.avi'],
        min_video_size_mb: config.scanner.minVideoSizeMB || 50,
        temporary_extensions: config.scanner.temporaryExtensions || ['.part', '.tmp', '.download', '.crdownload', '.!qB', '.filepart']
      });

      this.watchFolders = [defaultFolder];
      logger.info('Created default watch folder from environment configuration', {
        path: defaultFolder.path,
        id: defaultFolder.id
      });
    } catch (error: any) {
      logger.warn('Failed to create default watch folder', { error: error.message });
    }
  }

  /**
   * Get all watch folders
   */
  getWatchFolders(): WatchFolder[] {
    return [...this.watchFolders];
  }

  /**
   * Get enabled watch folders only
   */
  getEnabledWatchFolders(): WatchFolder[] {
    return this.watchFolders.filter(folder => folder.enabled);
  }

  /**
   * Get watch folder by ID
   */
  getWatchFolderById(id: number): WatchFolder | null {
    return this.watchFolders.find(folder => folder.id === id) || null;
  }

  /**
   * Refresh watch folders from database
   */
  refreshWatchFolders(): void {
    this.watchFolders = db.getAllWatchFolders();
    logger.debug('Refreshed watch folders from database', { count: this.watchFolders.length });
  }

  /**
   * Get a server setting
   */
  getSetting(key: string, defaultValue?: string): string {
    return this.serverSettings[key] ?? defaultValue ?? '';
  }

  /**
   * Get all server settings
   */
  getSettings(): Record<string, string> {
    return { ...this.serverSettings };
  }

  /**
   * Set a server setting (updates both cache and database)
   */
  setSetting(key: string, value: string): void {
    db.setSetting(key, value);
    this.serverSettings[key] = value;
    logger.debug('Updated server setting', { key, value });
  }

  /**
   * Refresh server settings from database
   */
  refreshSettings(): void {
    this.serverSettings = db.getAllSettings();
    logger.debug('Refreshed server settings from database');
  }

  /**
   * Get log level from settings
   */
  getLogLevel(): string {
    return this.getSetting('logLevel', config.logLevel || 'info');
  }

  /**
   * Check if IMDB lookup is enabled
   */
  isImdbEnabled(): boolean {
    return this.getSetting('imdbEnabled', 'true') === 'true';
  }

  /**
   * Check if scan on startup is enabled
   */
  isScanOnStartup(): boolean {
    return this.getSetting('scanOnStartup', 'true') === 'true';
  }
}

export default new ConfigService();
