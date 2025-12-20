import logger from '../../config/logger';
import { WatchFolder } from '../../types/watch-folder';
import { IStorageProvider } from './interface';
import { LocalStorageProvider } from './providers/local.provider';
import { NetworkStorageProvider } from './providers/network.provider';

/**
 * Storage provider factory that creates the appropriate provider instance
 * based on watch folder type
 */
export function createStorageProvider(watchFolder: WatchFolder): IStorageProvider {
  const storageType = watchFolder.type || 'local';

  logger.debug('Creating storage provider', { type: storageType, watchFolderId: watchFolder.id });

  switch (storageType) {
    case 'local':
      return new LocalStorageProvider();

    case 'network':
      return new NetworkStorageProvider();

    case 's3':
      // TODO: Implement S3 support
      throw new Error('S3 storage provider is not yet implemented. Please use local or network storage for now.');

    default:
      logger.warn('Unknown storage type, defaulting to local', { type: storageType });
      return new LocalStorageProvider();
  }
}
