import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import logger from '../config/logger';
import config from '../config';
import { FileRecord, DatabaseStats, ScanRecord } from '../types/database';
import { WatchFolder, WatchFolderDTO } from '../types/watch-folder';
import encryptionService from './encryption.service';
import { IDatabaseService } from './database/interface';
import { FileEntity } from './database/entities/file.entity';
import { ScanEntity } from './database/entities/scan.entity';
import { WatchFolderEntity } from './database/entities/watch-folder.entity';
import { ServerSettingEntity } from './database/entities/server-setting.entity';

/**
 * Database service using TypeORM
 * Supports SQLite, PostgreSQL, MySQL, and MariaDB
 */
class DatabaseService implements IDatabaseService {
  private dataSource!: DataSource;
  private fileRepository!: Repository<FileEntity>;
  private scanRepository!: Repository<ScanEntity>;
  private watchFolderRepository!: Repository<WatchFolderEntity>;
  private serverSettingRepository!: Repository<ServerSettingEntity>;
  private initialized: boolean = false;
  private initPromise!: Promise<void>;

  constructor() {
    // Start initialization asynchronously
    // Methods will wait for this to complete via ensureInitialized()
    this.initPromise = this.initialize();
  }

  /**
   * Initialize TypeORM DataSource based on configuration
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const dbType = (config.database.type || 'sqlite').toLowerCase();
    
    // Map database type to TypeORM driver type
    let typeormType: 'better-sqlite3' | 'postgres' | 'mysql' | 'mariadb';
    switch (dbType) {
      case 'sqlite':
        typeormType = 'better-sqlite3';
        break;
      case 'postgresql':
        typeormType = 'postgres';
        break;
      case 'mysql':
        typeormType = 'mysql';
        break;
      case 'mariadb':
        typeormType = 'mariadb';
        break;
      default:
        logger.warn('Unknown database type, defaulting to SQLite', { type: dbType });
        typeormType = 'better-sqlite3';
    }

    // Prepare database connection options
    const dataSourceOptions: any = {
      type: typeormType,
      entities: [FileEntity, ScanEntity, WatchFolderEntity, ServerSettingEntity],
      synchronize: process.env.NODE_ENV !== 'production', // Auto-sync schema in development only
      logging: config.logLevel === 'debug' ? ['query', 'error'] : ['error'],
    };

    // Configure based on database type
    if (typeormType === 'better-sqlite3') {
      // SQLite configuration
      const resolvedDbPath = path.isAbsolute(config.database.path)
        ? config.database.path
        : path.resolve(process.cwd(), config.database.path);

      // Ensure storage directory exists
      const storageDir = path.dirname(resolvedDbPath);
      if (!existsSync(storageDir)) {
        mkdirSync(storageDir, { recursive: true });
        logger.info('Created storage directory', { path: storageDir });
      }

      dataSourceOptions.database = resolvedDbPath;
      dataSourceOptions.extra = {
        pragma: {
          journal_mode: 'WAL',
        },
      };
    } else {
      // PostgreSQL, MySQL, MariaDB configuration
      dataSourceOptions.host = config.database.host || 'localhost';
      dataSourceOptions.port = config.database.port || (typeormType === 'postgres' ? 5432 : 3306);
      dataSourceOptions.username = config.database.username;
      dataSourceOptions.password = config.database.password;
      dataSourceOptions.database = config.database.database || 'stremio_nas';
    }

    this.dataSource = new DataSource(dataSourceOptions);
    
    try {
      await this.dataSource.initialize();
      this.fileRepository = this.dataSource.getRepository(FileEntity);
      this.scanRepository = this.dataSource.getRepository(ScanEntity);
      this.watchFolderRepository = this.dataSource.getRepository(WatchFolderEntity);
      this.serverSettingRepository = this.dataSource.getRepository(ServerSettingEntity);

      this.initialized = true;
      logger.info('TypeORM database initialized', {
        type: config.database.type,
        path: config.database.path,
      });
    } catch (error: any) {
      logger.error('Failed to initialize database', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
    if (!this.dataSource.isInitialized) {
      throw new Error('Database not initialized');
    }
  }

  /**
   * Convert FileEntity to FileRecord
   */
  private entityToFileRecord(entity: FileEntity): FileRecord {
    return {
      id: entity.id,
      name: entity.name,
      path: entity.path,
      size: entity.size,
      mtime: entity.mtime,
      parsedName: entity.parsedName ?? undefined,
      type: entity.type ?? undefined,
      imdb_id: entity.imdb_id ?? undefined,
      season: entity.season ?? undefined,
      episode: entity.episode ?? undefined,
      resolution: entity.resolution ?? undefined,
      source: entity.source ?? undefined,
      videoCodec: entity.videoCodec ?? undefined,
      audioCodec: entity.audioCodec ?? undefined,
      audioChannels: entity.audioChannels ?? undefined,
      languages: entity.languages ?? undefined,
      releaseGroup: entity.releaseGroup ?? undefined,
      flags: entity.flags ?? undefined,
      edition: entity.edition ?? undefined,
      imdbName: entity.imdbName ?? undefined,
      imdbYear: entity.imdbYear ?? undefined,
      imdbType: entity.imdbType ?? undefined,
      yearRange: entity.yearRange ?? undefined,
      image: entity.image ?? undefined,
      starring: entity.starring ?? undefined,
      similarity: entity.similarity ?? undefined,
      watch_folder_id: entity.watch_folder_id ?? undefined,
      createdAt: entity.createdAt?.toISOString(),
      updatedAt: entity.updatedAt?.toISOString(),
    };
  }

  /**
   * Convert FileRecord to FileEntity
   */
  private fileRecordToEntity(fileData: FileRecord): Partial<FileEntity> {
    return {
      name: fileData.name,
      path: fileData.path,
      size: fileData.size,
      mtime: fileData.mtime,
      parsedName: fileData.parsedName ?? null,
      type: fileData.type ?? null,
      imdb_id: fileData.imdb_id ?? null,
      season: fileData.season ?? null,
      episode: fileData.episode ?? null,
      resolution: fileData.resolution ?? null,
      source: fileData.source ?? null,
      videoCodec: fileData.videoCodec ?? null,
      audioCodec: fileData.audioCodec ?? null,
      audioChannels: fileData.audioChannels ?? null,
      languages: fileData.languages ?? null,
      releaseGroup: fileData.releaseGroup ?? null,
      flags: fileData.flags ?? null,
      edition: fileData.edition ?? null,
      imdbName: fileData.imdbName ?? null,
      imdbYear: fileData.imdbYear ?? null,
      imdbType: fileData.imdbType ?? null,
      yearRange: fileData.yearRange ?? null,
      image: fileData.image ?? null,
      starring: fileData.starring ?? null,
      similarity: fileData.similarity ?? null,
      watch_folder_id: fileData.watch_folder_id ?? null,
    };
  }

  // File operations

  async upsertFile(fileData: FileRecord): Promise<any> {
    await this.ensureInitialized();
    
    return await this.dataSource.transaction(async (manager) => {
      const fileRepository = manager.getRepository(FileEntity);
      const existing = await fileRepository.findOne({ where: { path: fileData.path } });
      
      const entityData = this.fileRecordToEntity(fileData);
      
      if (existing) {
        Object.assign(existing, entityData);
        const saved = await fileRepository.save(existing);
        return { changes: 1, lastInsertRowid: saved.id };
      } else {
        const newEntity = fileRepository.create(entityData);
        const saved = await fileRepository.save(newEntity);
        return { changes: 1, lastInsertRowid: saved.id };
      }
    });
  }

  async upsertFilesBatch(files: FileRecord[]): Promise<void> {
    await this.ensureInitialized();
    
    await this.dataSource.transaction(async (manager) => {
      const fileRepository = manager.getRepository(FileEntity);
      
      for (const fileData of files) {
        const existing = await fileRepository.findOne({ where: { path: fileData.path } });
        const entityData = this.fileRecordToEntity(fileData);
        
        if (existing) {
          Object.assign(existing, entityData);
          await fileRepository.save(existing);
        } else {
          const newEntity = fileRepository.create(entityData);
          await fileRepository.save(newEntity);
        }
      }
    });
  }

  async getAllFiles(): Promise<FileRecord[]> {
    await this.ensureInitialized();
    
    const entities = await this.fileRepository.find({ order: { name: 'ASC' } });
    return entities.map(e => this.entityToFileRecord(e));
  }

  async getFileById(fileId: number): Promise<FileRecord | null> {
    await this.ensureInitialized();
    
    const entity = await this.fileRepository.findOne({ where: { id: fileId } });
    return entity ? this.entityToFileRecord(entity) : null;
  }

  async getFileByPath(filePath: string): Promise<FileRecord | null> {
    await this.ensureInitialized();
    
    const entity = await this.fileRepository.findOne({ where: { path: filePath } });
    return entity ? this.entityToFileRecord(entity) : null;
  }

  async getFilesByImdb(imdbId: string): Promise<FileRecord[]> {
    await this.ensureInitialized();
    
    const entities = await this.fileRepository.find({ where: { imdb_id: imdbId } });
    return entities.map(e => this.entityToFileRecord(e));
  }

  async getFilesByImdbId(imdbId: string): Promise<FileRecord[]> {
    return await this.getFilesByImdb(imdbId);
  }

  async searchFiles(query: string): Promise<FileRecord[]> {
    await this.ensureInitialized();
    
    const pattern = `%${query}%`;
    
    const entities = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.name LIKE :pattern OR file.parsedName LIKE :pattern', { pattern })
      .orderBy('file.name', 'ASC')
      .getMany();
    return entities.map(e => this.entityToFileRecord(e));
  }

  async searchFilesByName(namePattern: string): Promise<FileRecord[]> {
    return await this.searchFiles(namePattern);
  }

  async filterByExtension(ext: string): Promise<FileRecord[]> {
    await this.ensureInitialized();
    
    const pattern = `%${ext}`;
    
    const entities = await this.fileRepository
      .createQueryBuilder('file')
      .where('file.name LIKE :pattern', { pattern })
      .orderBy('file.name', 'ASC')
      .getMany();
    return entities.map(e => this.entityToFileRecord(e));
  }

  async removeFile(filePath: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const result = await this.fileRepository.delete({ path: filePath });
    return (result.affected || 0) > 0;
  }

  async removeFilesNotInList(paths: string[], watchFolderId?: number): Promise<number> {
    await this.ensureInitialized();
    
    return await this.dataSource.transaction(async (manager) => {
      const fileRepository = manager.getRepository(FileEntity);
      
      if (paths.length === 0) {
        if (watchFolderId !== undefined) {
          const result = await fileRepository.delete({ watch_folder_id: watchFolderId });
          return result.affected || 0;
        } else {
          const result = await fileRepository.delete({});
          return result.affected || 0;
        }
      }

      if (watchFolderId !== undefined) {
        const result = await fileRepository
          .createQueryBuilder()
          .delete()
          .where('watch_folder_id = :watchFolderId', { watchFolderId })
          .andWhere('path NOT IN (:...paths)', { paths })
          .execute();
        return result.affected || 0;
      } else {
        const result = await fileRepository
          .createQueryBuilder()
          .delete()
          .where('path NOT IN (:...paths)', { paths })
          .execute();
        return result.affected || 0;
      }
    });
  }

  async clearFiles(): Promise<any> {
    await this.ensureInitialized();
    
    return await this.fileRepository.delete({});
  }

  // Scan operations

  async recordScan(stats: {
    filesFound: number;
    duration: number;
    errors?: number;
    processedCount?: number;
    skippedCount?: number;
    watchFolderId?: number;
  }): Promise<any> {
    await this.ensureInitialized();
    
    return await this.dataSource.transaction(async (manager) => {
      const scanRepository = manager.getRepository(ScanEntity);
      const scan = scanRepository.create({
        filesFound: stats.filesFound,
        duration: stats.duration,
        errors: stats.errors || 0,
        processedCount: stats.processedCount || 0,
        skippedCount: stats.skippedCount || 0,
        watch_folder_id: stats.watchFolderId || null,
      });
      const saved = await scanRepository.save(scan);
      return { changes: 1, lastInsertRowid: saved.id };
    });
  }

  async getScanHistory(limit: number = 10): Promise<ScanRecord[]> {
    await this.ensureInitialized();
    
    const entities = await this.scanRepository.find({
      order: { timestamp: 'DESC' },
      take: limit,
    });
    return entities.map(e => ({
      id: e.id,
      timestamp: e.timestamp.toISOString(),
      filesFound: e.filesFound,
      duration: e.duration,
      errors: e.errors,
      processedCount: e.processedCount,
      skippedCount: e.skippedCount,
      watch_folder_id: e.watch_folder_id ?? undefined,
    }));
  }

  // Statistics

  async getStats(): Promise<DatabaseStats> {
    await this.ensureInitialized();
    
    const totalFiles = await this.fileRepository.count();
    
    const uniqueImdbResult = await this.fileRepository
      .createQueryBuilder('file')
      .select('COUNT(DISTINCT file.imdb_id)', 'count')
      .where('file.imdb_id IS NOT NULL')
      .getRawOne();
    const uniqueImdb = parseInt(uniqueImdbResult?.count || '0', 10);
    
    const totalSizeResult = await this.fileRepository
      .createQueryBuilder('file')
      .select('SUM(file.size)', 'sum')
      .getRawOne();
    const totalSize = parseInt(totalSizeResult?.sum || '0', 10);
    
    const typeStats = await this.fileRepository
      .createQueryBuilder('file')
      .select('file.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('file.type')
      .getRawMany();
    
    const lastScanEntities = await this.scanRepository.find({
      order: { timestamp: 'DESC' },
      take: 1,
    });
    const lastScanEntity = lastScanEntities.length > 0 ? lastScanEntities[0] : null;

    return {
      totalFiles,
      uniqueImdb,
      totalSize,
      byType: typeStats.reduce((acc, row) => {
        acc[row.type || 'unknown'] = parseInt(row.count || '0', 10);
        return acc;
      }, {} as Record<string, number>),
      lastScan: lastScanEntity ? {
        id: lastScanEntity.id,
        timestamp: lastScanEntity.timestamp.toISOString(),
        filesFound: lastScanEntity.filesFound,
        duration: lastScanEntity.duration,
        errors: lastScanEntity.errors,
        processedCount: lastScanEntity.processedCount,
        skippedCount: lastScanEntity.skippedCount,
        watch_folder_id: lastScanEntity.watch_folder_id ?? undefined,
      } : null,
    };
  }

  // Watch folder operations

  async getAllWatchFolders(): Promise<WatchFolder[]> {
    await this.ensureInitialized();
    
    const entities = await this.watchFolderRepository.find({
      order: { name: 'ASC', path: 'ASC' },
    });
    return entities.map(e => this.entityToWatchFolder(e));
  }

  async getEnabledWatchFolders(): Promise<WatchFolder[]> {
    await this.ensureInitialized();
    
    const entities = await this.watchFolderRepository.find({
      where: { enabled: 1 },
      order: { name: 'ASC', path: 'ASC' },
    });
    return entities.map(e => this.entityToWatchFolder(e));
  }

  async getWatchFolderById(id: number): Promise<WatchFolder | null> {
    await this.ensureInitialized();
    
    const entity = await this.watchFolderRepository.findOne({ where: { id } });
    return entity ? this.entityToWatchFolder(entity) : null;
  }

  async getWatchFolderByPath(folderPath: string): Promise<WatchFolder | null> {
    await this.ensureInitialized();
    
    const entity = await this.watchFolderRepository.findOne({ where: { path: folderPath } });
    return entity ? this.entityToWatchFolder(entity) : null;
  }

  async createWatchFolder(data: WatchFolderDTO): Promise<WatchFolder> {
    await this.ensureInitialized();
    
    return await this.dataSource.transaction(async (manager) => {
      const watchFolderRepository = manager.getRepository(WatchFolderEntity);
      
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

      const entity = watchFolderRepository.create({
        path: data.path,
        name: data.name || null,
        enabled: data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
        scan_interval: data.scan_interval || '*/5 * * * *',
        allowed_extensions: data.allowed_extensions || ['.mp4', '.mkv', '.avi'],
        min_video_size_mb: data.min_video_size_mb || 50,
        temporary_extensions: data.temporary_extensions || ['.part', '.tmp', '.download', '.crdownload', '.!qB', '.filepart'],
        type: data.type || 'local',
        username: data.username || null,
        password_encrypted: passwordEncrypted,
        domain: data.domain || null,
      });

      const saved = await watchFolderRepository.save(entity);
      return this.entityToWatchFolder(saved);
    });
  }

  async updateWatchFolder(id: number, data: Partial<WatchFolderDTO>): Promise<WatchFolder | null> {
    await this.ensureInitialized();
    
    return await this.dataSource.transaction(async (manager) => {
      const watchFolderRepository = manager.getRepository(WatchFolderEntity);
      const existing = await watchFolderRepository.findOne({ where: { id } });
      
      if (!existing) {
        return null;
      }

      if (data.path !== undefined) existing.path = data.path;
      if (data.name !== undefined) existing.name = data.name || null;
      if (data.enabled !== undefined) existing.enabled = data.enabled ? 1 : 0;
      if (data.scan_interval !== undefined) existing.scan_interval = data.scan_interval;
      if (data.allowed_extensions !== undefined) existing.allowed_extensions = data.allowed_extensions;
      if (data.min_video_size_mb !== undefined) existing.min_video_size_mb = data.min_video_size_mb;
      if (data.temporary_extensions !== undefined) existing.temporary_extensions = data.temporary_extensions;
      if (data.type !== undefined) existing.type = data.type;
      if (data.username !== undefined) existing.username = data.username || null;
      if (data.domain !== undefined) existing.domain = data.domain || null;

      if (data.password !== undefined) {
        if (data.password) {
          try {
            existing.password_encrypted = encryptionService.encrypt(data.password);
          } catch (error: any) {
            logger.error('Failed to encrypt password', { error: error.message });
            throw new Error('Failed to encrypt password');
          }
        } else {
          existing.password_encrypted = null;
        }
      }

      const saved = await watchFolderRepository.save(existing);
      return this.entityToWatchFolder(saved);
    });
  }

  async deleteWatchFolder(id: number): Promise<boolean> {
    await this.ensureInitialized();
    
    const result = await this.watchFolderRepository.delete({ id });
    return (result.affected || 0) > 0;
  }

  async getDecryptedPassword(watchFolderId: number): Promise<string | null> {
    await this.ensureInitialized();
    
    const entity = await this.watchFolderRepository.findOne({
      where: { id: watchFolderId },
      select: ['password_encrypted'],
    });
    
    if (!entity || !entity.password_encrypted) {
      return null;
    }

    try {
      return encryptionService.decrypt(entity.password_encrypted);
    } catch (error: any) {
      logger.error('Failed to decrypt password', { watchFolderId, error: error.message });
      return null;
    }
  }

  /**
   * Convert WatchFolderEntity to WatchFolder
   */
  private entityToWatchFolder(entity: WatchFolderEntity): WatchFolder {
    return {
      id: entity.id,
      path: entity.path,
      name: entity.name ?? undefined,
      enabled: entity.enabled === 1,
      scan_interval: entity.scan_interval,
      allowed_extensions: entity.allowed_extensions,
      min_video_size_mb: entity.min_video_size_mb,
      temporary_extensions: entity.temporary_extensions,
      type: entity.type as 'local' | 'network' | 's3',
      username: entity.username ?? undefined,
      password_encrypted: undefined, // Never return encrypted password
      domain: entity.domain ?? undefined,
      created_at: entity.created_at.toISOString(),
      updated_at: entity.updated_at.toISOString(),
    };
  }

  // Server settings operations

  async getAllSettings(): Promise<Record<string, string>> {
    await this.ensureInitialized();
    
    const entities = await this.serverSettingRepository.find();
    return entities.reduce((acc, entity) => {
      acc[entity.key] = entity.value;
      return acc;
    }, {} as Record<string, string>);
  }

  async getSetting(key: string): Promise<string | null> {
    await this.ensureInitialized();
    
    const entity = await this.serverSettingRepository.findOne({ where: { key } });
    return entity ? entity.value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.ensureInitialized();
    
    await this.dataSource.transaction(async (manager) => {
      const settingRepository = manager.getRepository(ServerSettingEntity);
      const existing = await settingRepository.findOne({ where: { key } });
      
      if (existing) {
        existing.value = value;
        await settingRepository.save(existing);
      } else {
        const newSetting = settingRepository.create({ key, value });
        await settingRepository.save(newSetting);
      }
    });
  }

  async setSettings(settings: Record<string, string>): Promise<void> {
    await this.ensureInitialized();
    
    await this.dataSource.transaction(async (manager) => {
      const settingRepository = manager.getRepository(ServerSettingEntity);
      
      for (const [key, value] of Object.entries(settings)) {
        const existing = await settingRepository.findOne({ where: { key } });
        
        if (existing) {
          existing.value = value;
          await settingRepository.save(existing);
        } else {
          const newSetting = settingRepository.create({ key, value });
          await settingRepository.save(newSetting);
        }
      }
    });
  }

  async deleteSetting(key: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const result = await this.serverSettingRepository.delete({ key });
    return (result.affected || 0) > 0;
  }

  // Connection management

  async close(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      logger.info('Database connection closed');
    }
  }
}

/**
 * Singleton database service instance
 * Uses TypeORM with support for SQLite, PostgreSQL, MySQL, and MariaDB
 */
const databaseService = new DatabaseService();

export default databaseService;
