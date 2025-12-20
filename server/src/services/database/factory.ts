import logger from '../../config/logger';
import config from '../../config';
import { IDatabaseService } from './interface';
import { SqliteDatabaseService } from './providers/sqlite.database.service';

export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql' | 'mariadb';

/**
 * Database factory that creates the appropriate database service instance
 * based on configuration
 */
export function createDatabaseService(): IDatabaseService {
  const dbType = (config.database.type || 'sqlite').toLowerCase() as DatabaseType;

  logger.info('Initializing database service', { type: dbType });

  switch (dbType) {
    case 'sqlite':
      return new SqliteDatabaseService(config.database.path);

    case 'postgresql':
      // TODO: Implement PostgreSQL support
      throw new Error('PostgreSQL database support is not yet implemented. Please use SQLite for now.');

    case 'mysql':
    case 'mariadb':
      // TODO: Implement MySQL/MariaDB support
      throw new Error('MySQL/MariaDB database support is not yet implemented. Please use SQLite for now.');

    default:
      logger.warn('Unknown database type, defaulting to SQLite', { type: dbType });
      return new SqliteDatabaseService(config.database.path);
  }
}
