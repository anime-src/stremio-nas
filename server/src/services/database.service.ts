import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import logger from '../config/logger';
import config from '../config';
import { FileRecord, DatabaseStats, ScanRecord, PreparedStatements } from '../types/database';
import { WatchFolder, WatchFolderDTO } from '../types/watch-folder';
import encryptionService from './encryption.service';

/**
 * Database service using better-sqlite3 for persistent storage
 */
class DatabaseService {
  private db: Database.Database;
  private stmts!: PreparedStatements;

  constructor() {
    // Use DB_PATH from config (can be absolute or relative)
    const dbPath = config.database.path;
    
    // If path is relative, resolve it relative to project root
    const resolvedDbPath = path.isAbsolute(dbPath) 
      ? dbPath 
      : path.resolve(process.cwd(), dbPath);
    
    // Ensure storage directory exists
    const storageDir = path.dirname(resolvedDbPath);
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
      logger.info('Created storage directory', { path: storageDir });
    }

    this.db = new Database(resolvedDbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    
    logger.info('Database initialized', { path: resolvedDbPath });
    this.initialize();
  }

  private initialize(): void {
    // Create files table with metadata columns
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT UNIQUE NOT NULL,
        size INTEGER NOT NULL,
        mtime INTEGER NOT NULL,
        parsedName TEXT,
        type TEXT,
        imdb_id TEXT,
        season INTEGER,
        episode INTEGER,
        resolution TEXT,
        source TEXT,
        videoCodec TEXT,
        audioCodec TEXT,
        audioChannels TEXT,
        languages TEXT,
        releaseGroup TEXT,
        flags TEXT,
        edition TEXT,
        imdbName TEXT,
        imdbYear INTEGER,
        imdbType TEXT,
        yearRange TEXT,
        image TEXT,
        starring TEXT,
        similarity REAL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_files_imdb ON files(imdb_id);
      CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);
      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
      CREATE INDEX IF NOT EXISTS idx_files_resolution ON files(resolution);
      CREATE INDEX IF NOT EXISTS idx_files_source ON files(source);
      CREATE INDEX IF NOT EXISTS idx_files_videoCodec ON files(videoCodec);
      CREATE INDEX IF NOT EXISTS idx_files_releaseGroup ON files(releaseGroup);
    `);

    // Create scans table for history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        filesFound INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        errors INTEGER DEFAULT 0,
        processedCount INTEGER DEFAULT 0,
        skippedCount INTEGER DEFAULT 0
      );
    `);
    
    // Add processedCount and skippedCount columns if they don't exist (migration for existing databases)
    try {
      this.db.exec(`ALTER TABLE scans ADD COLUMN processedCount INTEGER DEFAULT 0`);
      this.db.exec(`ALTER TABLE scans ADD COLUMN skippedCount INTEGER DEFAULT 0`);
      logger.info('Added processedCount and skippedCount columns to scans table');
    } catch (e: any) {
      // Columns already exist, ignore
      if (!e.message.includes('duplicate column')) {
        logger.warn('Error adding scan statistics columns', { error: e.message });
      }
    }

    // Add watch_folder_id to files table if it doesn't exist (for tracking which folder a file belongs to)
    try {
      this.db.exec(`ALTER TABLE files ADD COLUMN watch_folder_id INTEGER`);
      logger.info('Added watch_folder_id column to files table');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) {
        logger.warn('Error adding watch_folder_id column to files', { error: e.message });
      }
    }

    // Add watch_folder_id to scans table for tracking which folder was scanned (must be before prepared statements)
    try {
      this.db.exec(`ALTER TABLE scans ADD COLUMN watch_folder_id INTEGER`);
      logger.info('Added watch_folder_id column to scans table');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) {
        logger.warn('Error adding watch_folder_id column to scans', { error: e.message });
      }
    }

    // Prepare statements (faster than dynamic queries)
    this.stmts = {
      insertFile: this.db.prepare(`
        INSERT INTO files (name, path, size, mtime, parsedName, type, imdb_id, season, episode, resolution, source, videoCodec, audioCodec, audioChannels, languages, releaseGroup, flags, edition, imdbName, imdbYear, imdbType, yearRange, image, starring, similarity, watch_folder_id, updatedAt)
        VALUES (@name, @path, @size, @mtime, @parsedName, @type, @imdb_id, @season, @episode, @resolution, @source, @videoCodec, @audioCodec, @audioChannels, @languages, @releaseGroup, @flags, @edition, @imdbName, @imdbYear, @imdbType, @yearRange, @image, @starring, @similarity, @watch_folder_id, CURRENT_TIMESTAMP)
        ON CONFLICT(path) DO UPDATE SET
          name = @name,
          size = @size,
          mtime = @mtime,
          parsedName = @parsedName,
          type = @type,
          imdb_id = @imdb_id,
          season = @season,
          episode = @episode,
          resolution = @resolution,
          source = @source,
          videoCodec = @videoCodec,
          audioCodec = @audioCodec,
          audioChannels = @audioChannels,
          languages = @languages,
          releaseGroup = @releaseGroup,
          flags = @flags,
          edition = @edition,
          imdbName = @imdbName,
          imdbYear = @imdbYear,
          imdbType = @imdbType,
          yearRange = @yearRange,
          image = @image,
          starring = @starring,
          similarity = @similarity,
          watch_folder_id = @watch_folder_id,
          updatedAt = CURRENT_TIMESTAMP
      `) as Database.Statement<FileRecord>,
      getAllFiles: this.db.prepare('SELECT * FROM files ORDER BY name') as Database.Statement<[]>,
      getFileById: this.db.prepare('SELECT * FROM files WHERE id = ?') as Database.Statement<[number]>,
      getFileByPath: this.db.prepare('SELECT * FROM files WHERE path = ?') as Database.Statement<[string]>,
      getFilesByImdb: this.db.prepare('SELECT * FROM files WHERE imdb_id = ?') as Database.Statement<[string]>,
      deleteFile: this.db.prepare('DELETE FROM files WHERE path = ?') as Database.Statement<[string]>,
      clearFiles: this.db.prepare('DELETE FROM files') as Database.Statement<[]>,
      searchFiles: this.db.prepare(`
        SELECT * FROM files 
        WHERE name LIKE ? OR parsedName LIKE ?
        ORDER BY name
      `) as Database.Statement<[string, string]>,
      filterByExtension: this.db.prepare(`
        SELECT * FROM files 
        WHERE name LIKE ?
        ORDER BY name
      `) as Database.Statement<[string]>,
      insertScan: this.db.prepare(`
        INSERT INTO scans (filesFound, duration, errors, processedCount, skippedCount, watch_folder_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `) as Database.Statement<[number, number, number, number, number, number | null]>,
      getScanHistory: this.db.prepare(`
        SELECT * FROM scans 
        ORDER BY timestamp DESC 
        LIMIT ?
      `) as Database.Statement<[number]>,
      getStats: this.db.prepare(`
        SELECT 
          COUNT(*) as totalFiles,
          COUNT(DISTINCT imdb_id) as uniqueImdb,
          SUM(size) as totalSize
        FROM files
      `) as Database.Statement<[]>,
      getTypeStats: this.db.prepare(`
        SELECT type, COUNT(*) as count 
        FROM files 
        GROUP BY type
      `) as Database.Statement<[]>
    };

    // Add mtime column if it doesn't exist (migration for existing databases)
    try {
      this.db.exec(`ALTER TABLE files ADD COLUMN mtime INTEGER DEFAULT 0`);
      logger.info('Added mtime column to files table');
    } catch (e: any) {
      // Column already exists, ignore
      if (!e.message.includes('duplicate column')) {
        logger.warn('Error adding mtime column', { error: e.message });
      }
    }

    // Remove url column if it exists (migration for existing databases)
    try {
      // SQLite doesn't support DROP COLUMN directly, so we'll just ignore it
      // The column will remain but won't be used
      logger.info('URL column migration: column will be ignored if present');
    } catch (e: any) {
      logger.warn('Error during URL column migration', { error: e.message });
    }

    // Create watch_folders table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS watch_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        name TEXT,
        enabled INTEGER DEFAULT 1,
        scan_interval TEXT NOT NULL,
        allowed_extensions TEXT NOT NULL,
        min_video_size_mb INTEGER DEFAULT 50,
        temporary_extensions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_watch_folders_enabled ON watch_folders(enabled);
      CREATE INDEX IF NOT EXISTS idx_watch_folders_path ON watch_folders(path);
    `);

    // Migration: Add network path support columns
    // Check if columns exist before adding (for existing databases)
    const tableInfo = this.db.prepare("PRAGMA table_info(watch_folders)").all() as any[];
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('type')) {
      this.db.exec(`
        ALTER TABLE watch_folders ADD COLUMN type TEXT DEFAULT 'local';
        ALTER TABLE watch_folders ADD COLUMN username TEXT;
        ALTER TABLE watch_folders ADD COLUMN password_encrypted TEXT;
        ALTER TABLE watch_folders ADD COLUMN domain TEXT;
      `);
      logger.info('Added network path support columns to watch_folders table');
    }

    // Create server_settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS server_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);


    const count = this.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };
    logger.info('Database tables initialized', { fileCount: count.count });
  }

  /**
   * Upsert a single file
   */
  upsertFile(fileData: FileRecord): Database.RunResult {
    // Convert arrays to JSON strings for storage
    const data: any = { ...fileData };
    if (Array.isArray(data.languages)) {
      data.languages = JSON.stringify(data.languages);
    }
    if (Array.isArray(data.flags)) {
      data.flags = JSON.stringify(data.flags);
    }
    if (typeof data.image === 'object' && data.image !== null) {
      data.image = JSON.stringify(data.image);
    }
    return this.stmts.insertFile.run(data);
  }

  /**
   * Batch upsert files (uses transaction for speed)
   */
  upsertFilesBatch(files: FileRecord[]): void {
    const insert = this.db.transaction((files: FileRecord[]) => {
      for (const file of files) {
        this.upsertFile(file);
      }
    });
    
    insert(files);
  }

  /**
   * Parse JSON strings in file row to objects/arrays
   * @private
   */
  private _parseFileRow(row: any): FileRecord | null {
    if (!row) return row;
    
    const parsed: FileRecord = { ...row };
    
    // Parse JSON strings to objects/arrays
    if (parsed.languages && typeof parsed.languages === 'string') {
      try {
        parsed.languages = JSON.parse(parsed.languages);
      } catch (e) {
        logger.warn('Failed to parse languages JSON', { languages: parsed.languages });
        parsed.languages = null;
      }
    }
    
    if (parsed.flags && typeof parsed.flags === 'string') {
      try {
        parsed.flags = JSON.parse(parsed.flags);
      } catch (e) {
        logger.warn('Failed to parse flags JSON', { flags: parsed.flags });
        parsed.flags = null;
      }
    }
    
    if (parsed.image && typeof parsed.image === 'string') {
      try {
        parsed.image = JSON.parse(parsed.image);
      } catch (e) {
        logger.warn('Failed to parse image JSON', { image: parsed.image });
        parsed.image = null;
      }
    }
    
    return parsed;
  }

  /**
   * Get all files
   */
  getAllFiles(): FileRecord[] {
    return this.stmts.getAllFiles.all().map((row: any) => this._parseFileRow(row)!).filter(Boolean);
  }

  /**
   * Get file by ID
   */
  getFileById(fileId: number): FileRecord | null {
    const row = this.stmts.getFileById.get(fileId);
    return this._parseFileRow(row);
  }

  /**
   * Get file by path
   */
  getFileByPath(filePath: string): FileRecord | null {
    const row = this.stmts.getFileByPath.get(filePath);
    return this._parseFileRow(row);
  }

  /**
   * Get files by IMDB ID
   */
  getFilesByImdb(imdbId: string): FileRecord[] {
    return this.stmts.getFilesByImdb.all(imdbId).map((row: any) => this._parseFileRow(row)!).filter(Boolean);
  }

  /**
   * Search files by name
   */
  searchFiles(query: string): FileRecord[] {
    const pattern = `%${query}%`;
    return this.stmts.searchFiles.all(pattern, pattern).map((row: any) => this._parseFileRow(row)!).filter(Boolean);
  }

  /**
   * Filter files by extension
   */
  filterByExtension(ext: string): FileRecord[] {
    const pattern = `%${ext}`;
    return this.stmts.filterByExtension.all(pattern).map((row: any) => this._parseFileRow(row)!).filter(Boolean);
  }

  /**
   * Get files by IMDB ID
   */
  getFilesByImdbId(imdbId: string): FileRecord[] {
    return this.stmts.getFilesByImdb.all(imdbId).map((row: any) => this._parseFileRow(row)!).filter(Boolean);
  }

  /**
   * Search files by name (case-insensitive partial match)
   */
  searchFilesByName(namePattern: string): FileRecord[] {
    const pattern = `%${namePattern}%`;
    return this.stmts.searchFiles.all(pattern, pattern).map((row: any) => this._parseFileRow(row)!).filter(Boolean);
  }

  /**
   * Record a scan to history
   */
  recordScan(stats: { filesFound: number; duration: number; errors?: number; processedCount?: number; skippedCount?: number; watchFolderId?: number }): Database.RunResult {
    return this.stmts.insertScan.run(
      stats.filesFound,
      stats.duration,
      stats.errors || 0,
      stats.processedCount || 0,
      stats.skippedCount || 0,
      stats.watchFolderId || null
    );
  }

  /**
   * Get scan history
   */
  getScanHistory(limit: number = 10): ScanRecord[] {
    return this.stmts.getScanHistory.all(limit) as ScanRecord[];
  }

  /**
   * Remove a file from database
   */
  removeFile(filePath: string): boolean {
    const result = this.stmts.deleteFile.run(filePath);
    return result.changes > 0;
  }

  /**
   * Remove files that are not in the provided list of paths
   * Used to sync database with filesystem after scanning
   * @param paths - List of file paths that should remain
   * @param watchFolderId - Optional watch folder ID to only remove files from this folder
   */
  removeFilesNotInList(paths: string[], watchFolderId?: number): number {
    if (paths.length === 0) {
      if (watchFolderId !== undefined) {
        // Remove all files from this watch folder
        const deleteStmt = this.db.prepare(`DELETE FROM files WHERE watch_folder_id = ?`);
        const result = deleteStmt.run(watchFolderId);
        return result.changes;
      } else {
        // If no files found and no watch folder specified, clear everything
        const result = this.stmts.clearFiles.run();
        return result.changes;
      }
    }

    // Build placeholders for SQL IN clause
    const placeholders = paths.map(() => '?').join(',');
    let deleteStmt: Database.Statement;
    
    if (watchFolderId !== undefined) {
      // Only remove files from this watch folder that are not in the list
      deleteStmt = this.db.prepare(`
        DELETE FROM files 
        WHERE watch_folder_id = ? AND path NOT IN (${placeholders})
      `);
      const result = deleteStmt.run(watchFolderId, ...paths);
      return result.changes;
    } else {
      // Remove files not in list (backward compatibility)
      deleteStmt = this.db.prepare(`
        DELETE FROM files WHERE path NOT IN (${placeholders})
      `);
      const result = deleteStmt.run(...paths);
      return result.changes;
    }
  }

  /**
   * Clear all files (use with caution)
   */
  clearFiles(): Database.RunResult {
    return this.stmts.clearFiles.run();
  }

  /**
   * Get database statistics
   */
  getStats(): DatabaseStats {
    const stats = this.stmts.getStats.get() as { totalFiles: number; uniqueImdb: number; totalSize: number };
    const typeStats = this.stmts.getTypeStats.all() as Array<{ type: string | null; count: number }>;
    const scanHistory = this.stmts.getScanHistory.all(1) as ScanRecord[];

    return {
      totalFiles: stats.totalFiles,
      uniqueImdb: stats.uniqueImdb,
      totalSize: stats.totalSize,
      byType: typeStats.reduce((acc, row) => {
        acc[row.type || 'unknown'] = row.count;
        return acc;
      }, {} as Record<string, number>),
      lastScan: scanHistory[0] || null
    };
  }

  /**
   * Watch Folders CRUD Operations
   */

  /**
   * Get all watch folders
   */
  getAllWatchFolders(): WatchFolder[] {
    const stmt = this.db.prepare('SELECT * FROM watch_folders ORDER BY name, path');
    const rows = stmt.all() as any[];
    return rows.map(row => this._parseWatchFolderRow(row));
  }

  /**
   * Get enabled watch folders only
   */
  getEnabledWatchFolders(): WatchFolder[] {
    const stmt = this.db.prepare('SELECT * FROM watch_folders WHERE enabled = 1 ORDER BY name, path');
    const rows = stmt.all() as any[];
    return rows.map(row => this._parseWatchFolderRow(row));
  }

  /**
   * Get watch folder by ID
   */
  getWatchFolderById(id: number): WatchFolder | null {
    const stmt = this.db.prepare('SELECT * FROM watch_folders WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this._parseWatchFolderRow(row) : null;
  }

  /**
   * Get watch folder by path
   */
  getWatchFolderByPath(folderPath: string): WatchFolder | null {
    const stmt = this.db.prepare('SELECT * FROM watch_folders WHERE path = ?');
    const row = stmt.get(folderPath) as any;
    return row ? this._parseWatchFolderRow(row) : null;
  }

  /**
   * Create a new watch folder
   */
  createWatchFolder(data: WatchFolderDTO): WatchFolder {
    // Encrypt password if provided
    let passwordEncrypted: string | null = null;
    if (data.password) {
      try {
        passwordEncrypted = encryptionService.encrypt(data.password);
      } catch (error: any) {
        logger.error('Failed to encrypt password', { error: error.message });
        throw new Error('Failed to encrypt password');
      }
    }

    const type = data.type || 'local';
    const stmt = this.db.prepare(`
      INSERT INTO watch_folders (path, name, enabled, scan_interval, allowed_extensions, min_video_size_mb, temporary_extensions, type, username, password_encrypted, domain, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    const result = stmt.run(
      data.path,
      data.name || null,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
      data.scan_interval || '*/5 * * * *',
      JSON.stringify(data.allowed_extensions || ['.mp4', '.mkv', '.avi']),
      data.min_video_size_mb || 50,
      JSON.stringify(data.temporary_extensions || ['.part', '.tmp', '.download', '.crdownload', '.!qB', '.filepart']),
      type,
      data.username || null,
      passwordEncrypted,
      data.domain || null
    );

    const created = this.getWatchFolderById(result.lastInsertRowid as number);
    if (!created) {
      throw new Error('Failed to retrieve created watch folder');
    }
    return created;
  }

  /**
   * Update a watch folder
   */
  updateWatchFolder(id: number, data: Partial<WatchFolderDTO>): WatchFolder | null {
    const existing = this.getWatchFolderById(id);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.path !== undefined) {
      updates.push('path = ?');
      values.push(data.path);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name || null);
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }
    if (data.scan_interval !== undefined) {
      updates.push('scan_interval = ?');
      values.push(data.scan_interval);
    }
    if (data.allowed_extensions !== undefined) {
      updates.push('allowed_extensions = ?');
      values.push(JSON.stringify(data.allowed_extensions));
    }
    if (data.min_video_size_mb !== undefined) {
      updates.push('min_video_size_mb = ?');
      values.push(data.min_video_size_mb);
    }
    if (data.temporary_extensions !== undefined) {
      updates.push('temporary_extensions = ?');
      values.push(JSON.stringify(data.temporary_extensions));
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if (data.username !== undefined) {
      updates.push('username = ?');
      values.push(data.username || null);
    }
    if (data.password !== undefined) {
      // Encrypt password if provided
      if (data.password) {
        try {
          const passwordEncrypted = encryptionService.encrypt(data.password);
          updates.push('password_encrypted = ?');
          values.push(passwordEncrypted);
        } catch (error: any) {
          logger.error('Failed to encrypt password', { error: error.message });
          throw new Error('Failed to encrypt password');
        }
      } else {
        // Empty string means clear the password
        updates.push('password_encrypted = ?');
        values.push(null);
      }
    }
    if (data.domain !== undefined) {
      updates.push('domain = ?');
      values.push(data.domain || null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE watch_folders 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    
    stmt.run(...values);
    return this.getWatchFolderById(id);
  }

  /**
   * Delete a watch folder
   */
  deleteWatchFolder(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM watch_folders WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Get decrypted password for a watch folder (internal use only)
   * Never expose this in API responses
   */
  getDecryptedPassword(watchFolderId: number): string | null {
    const stmt = this.db.prepare('SELECT password_encrypted FROM watch_folders WHERE id = ?');
    const row = stmt.get(watchFolderId) as any;
    
    if (!row || !row.password_encrypted) {
      return null;
    }

    try {
      return encryptionService.decrypt(row.password_encrypted);
    } catch (error: any) {
      logger.error('Failed to decrypt password', { watchFolderId, error: error.message });
      return null;
    }
  }

  /**
   * Parse watch folder row from database
   * Never returns password_encrypted for security
   * @private
   */
  private _parseWatchFolderRow(row: any): WatchFolder {
    return {
      id: row.id,
      path: row.path,
      name: row.name,
      enabled: row.enabled === 1,
      scan_interval: row.scan_interval,
      allowed_extensions: JSON.parse(row.allowed_extensions),
      min_video_size_mb: row.min_video_size_mb,
      temporary_extensions: JSON.parse(row.temporary_extensions),
      type: (row.type || 'local') as 'local' | 'network',
      username: row.username || null,
      password_encrypted: undefined, // Never return encrypted password
      domain: row.domain || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Server Settings Operations
   */

  /**
   * Get all server settings
   */
  getAllSettings(): Record<string, string> {
    const stmt = this.db.prepare('SELECT key, value FROM server_settings');
    const rows = stmt.all() as Array<{ key: string; value: string }>;
    return rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Get a specific server setting
   */
  getSetting(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM server_settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  /**
   * Set a server setting (upsert)
   */
  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO server_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value);
  }

  /**
   * Set multiple server settings
   */
  setSettings(settings: Record<string, string>): void {
    const set = this.db.transaction((settings: Record<string, string>) => {
      for (const [key, value] of Object.entries(settings)) {
        this.setSetting(key, value);
      }
    });
    set(settings);
  }

  /**
   * Delete a server setting
   */
  deleteSetting(key: string): boolean {
    const stmt = this.db.prepare('DELETE FROM server_settings WHERE key = ?');
    const result = stmt.run(key);
    return result.changes > 0;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export default new DatabaseService();
