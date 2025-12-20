/**
 * Database service - factory-based implementation
 * 
 * This module exports a singleton database service instance created by the factory.
 * The default implementation is SQLite, but other database types can be configured
 * via the DB_TYPE environment variable.
 * 
 * Usage:
 *   import db from './services/database.service';
 *   const files = db.getAllFiles();
 * 
 * To use a different database:
 *   Set DB_TYPE=postgresql (or mysql, mariadb) in your environment
 *   Note: PostgreSQL/MySQL providers need to be added first
 */
import { createDatabaseService } from './database/factory';

  /**
 * Singleton database service instance
 * Created using the factory based on configuration
 * Defaults to SQLite if DB_TYPE is not specified
 */
const databaseService = createDatabaseService();

export default databaseService;
