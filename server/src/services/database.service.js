const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

/**
 * Database service using better-sqlite3 for persistent storage
 */
class DatabaseService {
  constructor() {
    // Ensure storage directory exists
    const storageDir = path.join(__dirname, '../../storage');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const dbPath = path.join(storageDir, 'media.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    
    this.initialize();
  }

  initialize() {
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
    } catch (e) {
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
      `),
      getAllFiles: this.db.prepare('SELECT * FROM files ORDER BY name'),
      getFileById: this.db.prepare('SELECT * FROM files WHERE id = ?'),
      getFileByPath: this.db.prepare('SELECT * FROM files WHERE path = ?'),
      getFilesByImdb: this.db.prepare('SELECT * FROM files WHERE imdb_id = ?'),
      deleteFile: this.db.prepare('DELETE FROM files WHERE path = ?'),
      clearFiles: this.db.prepare('DELETE FROM files'),
      searchFiles: this.db.prepare(`
        SELECT * FROM files 
        WHERE name LIKE ? OR parsedName LIKE ?
        ORDER BY name
      `),
      filterByExtension: this.db.prepare(`
        SELECT * FROM files 
        WHERE name LIKE ?
        ORDER BY name
      `),
      insertScan: this.db.prepare(`
        INSERT INTO scans (filesFound, duration, errors, processedCount, skippedCount)
        VALUES (?, ?, ?, ?, ?)
      `),
      getScanHistory: this.db.prepare(`
        SELECT * FROM scans 
        ORDER BY timestamp DESC 
        LIMIT ?
      `),
      getStats: this.db.prepare(`
        SELECT 
          COUNT(*) as totalFiles,
          COUNT(DISTINCT imdb_id) as uniqueImdb,
          SUM(size) as totalSize
        FROM files
      `),
      getTypeStats: this.db.prepare(`
        SELECT type, COUNT(*) as count 
        FROM files 
        GROUP BY type
      `)
    };

    // Add mtime column if it doesn't exist (migration for existing databases)
    try {
      this.db.exec(`ALTER TABLE files ADD COLUMN mtime INTEGER DEFAULT 0`);
      logger.info('Added mtime column to files table');
    } catch (e) {
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
    } catch (e) {
      logger.warn('Error during URL column migration', { error: e.message });
    }

    const count = this.db.prepare('SELECT COUNT(*) as count FROM files').get();
    logger.info('Database initialized', { fileCount: count.count });
  }

  /**
   * Upsert a single file
   */
  upsertFile(fileData) {
    return this.stmts.insertFile.run(fileData);
  }

  /**
   * Batch upsert files (uses transaction for speed)
   */
  upsertFilesBatch(files) {
    const insert = this.db.transaction((files) => {
      for (const file of files) {
        this.stmts.insertFile.run(file);
      }
    });
    
    return insert(files);
  }

  /**
   * Parse JSON strings in file row to objects/arrays
   * @private
   */
  _parseFileRow(row) {
    if (!row) return row;
    
    const parsed = { ...row };
    
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
  getAllFiles() {
    return this.stmts.getAllFiles.all().map(row => this._parseFileRow(row));
  }

  /**
   * Get file by ID
   */
  getFileById(fileId) {
    const row = this.stmts.getFileById.get(fileId);
    return this._parseFileRow(row);
  }

  /**
   * Get file by path
   */
  getFileByPath(filePath) {
    const row = this.stmts.getFileByPath.get(filePath);
    return this._parseFileRow(row);
  }

  /**
   * Get files by IMDB ID
   */
  getFilesByImdb(imdbId) {
    return this.stmts.getFilesByImdb.all(imdbId).map(row => this._parseFileRow(row));
  }

  /**
   * Search files by name
   */
  searchFiles(query) {
    const pattern = `%${query}%`;
    return this.stmts.searchFiles.all(pattern, pattern).map(row => this._parseFileRow(row));
  }

  /**
   * Filter files by extension
   */
  filterByExtension(ext) {
    const pattern = `%${ext}`;
    return this.stmts.filterByExtension.all(pattern).map(row => this._parseFileRow(row));
  }

  /**
   * Get files by IMDB ID
   */
  getFilesByImdbId(imdbId) {
    return this.stmts.getFilesByImdb.all(imdbId).map(row => this._parseFileRow(row));
  }

  /**
   * Search files by name (case-insensitive partial match)
   */
  searchFilesByName(namePattern) {
    const pattern = `%${namePattern}%`;
    return this.stmts.searchFiles.all(pattern, pattern).map(row => this._parseFileRow(row));
  }

  /**
   * Record a scan to history
   */
  recordScan(stats) {
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
  getScanHistory(limit = 10) {
    return this.stmts.getScanHistory.all(limit);
  }

  /**
   * Remove a file from database
   */
  removeFile(filePath) {
    const result = this.stmts.deleteFile.run(filePath);
    return result.changes > 0;
  }

  /**
   * Remove files that are not in the provided list of paths
   * Used to sync database with filesystem after scanning
   */
  removeFilesNotInList(paths) {
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
  clearFiles() {
    return this.stmts.clearFiles.run();
  }

  /**
   * Get database statistics
   */
  getStats() {
    const stats = this.stmts.getStats.get();
    const typeStats = this.stmts.getTypeStats.all();
    const scanHistory = this.stmts.getScanHistory.all(1);

    return {
      totalFiles: stats.totalFiles,
      uniqueImdb: stats.uniqueImdb,
      totalSize: stats.totalSize,
      byType: typeStats.reduce((acc, row) => {
        acc[row.type || 'unknown'] = row.count;
        return acc;
      }, {}),
      lastScan: scanHistory[0] || null
    };
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = new DatabaseService();

