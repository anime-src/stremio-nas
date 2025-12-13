import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import logger from '../config/logger';
import config from '../config';
import { FileRecord, DatabaseStats, ScanRecord, PreparedStatements } from '../types/database';

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

    // Prepare statements (faster than dynamic queries)
    this.stmts = {
      insertFile: this.db.prepare(`
        INSERT INTO files (name, path, size, mtime, parsedName, type, imdb_id, season, episode, resolution, source, videoCodec, audioCodec, audioChannels, languages, releaseGroup, flags, edition, imdbName, imdbYear, imdbType, yearRange, image, starring, similarity, updatedAt)
        VALUES (@name, @path, @size, @mtime, @parsedName, @type, @imdb_id, @season, @episode, @resolution, @source, @videoCodec, @audioCodec, @audioChannels, @languages, @releaseGroup, @flags, @edition, @imdbName, @imdbYear, @imdbType, @yearRange, @image, @starring, @similarity, CURRENT_TIMESTAMP)
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
        INSERT INTO scans (filesFound, duration, errors, processedCount, skippedCount)
        VALUES (?, ?, ?, ?, ?)
      `) as Database.Statement<[number, number, number, number, number]>,
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
  recordScan(stats: { filesFound: number; duration: number; errors?: number; processedCount?: number; skippedCount?: number }): Database.RunResult {
    return this.stmts.insertScan.run(
      stats.filesFound,
      stats.duration,
      stats.errors || 0,
      stats.processedCount || 0,
      stats.skippedCount || 0
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
   */
  removeFilesNotInList(paths: string[]): number {
    if (paths.length === 0) {
      // If no files found, clear everything
      const result = this.stmts.clearFiles.run();
      return result.changes;
    }

    // Build placeholders for SQL IN clause
    const placeholders = paths.map(() => '?').join(',');
    const deleteStmt = this.db.prepare(`
      DELETE FROM files WHERE path NOT IN (${placeholders})
    `);
    
    const result = deleteStmt.run(...paths);
    return result.changes;
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
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export default new DatabaseService();
