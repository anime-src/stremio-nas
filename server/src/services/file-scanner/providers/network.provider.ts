import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../../../config/logger';
import db from '../../database.service';
import { IStorageProvider, RawFile, ScanOptions } from '../interface';
import { WatchFolder } from '../../../types/watch-folder';
import { LocalStorageProvider } from './local.provider';

const execAsync = promisify(exec);

/**
 * Network storage provider (CIFS/SMB)
 * Mounts network paths and then scans them using local filesystem provider
 */
export class NetworkStorageProvider implements IStorageProvider {
  // Track mounted network paths: watchFolderId -> mountPoint
  private mountedPaths: Map<number, string> = new Map();
  private localProvider: LocalStorageProvider;

  constructor() {
    this.localProvider = new LocalStorageProvider();
  }

  getSupportedType(): string {
    return 'network';
  }

  /**
   * Mount network path before scanning
   */
  async connect(watchFolder: WatchFolder): Promise<void> {
    if (!watchFolder.id) {
      throw new Error('Watch folder ID is required for network mounting');
    }

    // Check if already mounted
    if (this.mountedPaths.has(watchFolder.id)) {
      const existingMount = this.mountedPaths.get(watchFolder.id)!;
      logger.debug('Network path already mounted', {
        watchFolderId: watchFolder.id,
        mountPoint: existingMount
      });
      return;
    }

    const mountPoint = await this._mountNetworkPath(watchFolder);
    if (!mountPoint) {
      throw new Error('Failed to mount network path');
    }
  }

  /**
   * Unmount network path after scanning (optional, can be kept mounted)
   */
  async disconnect(watchFolderId: number): Promise<void> {
    // Note: We typically keep mounts active for scheduled scans
    // This method is available for manual cleanup if needed
    await this.unmountNetworkPath(watchFolderId);
  }

  /**
   * Scan network storage by mounting it first, then using local provider
   */
  async scan(watchFolder: WatchFolder, options: ScanOptions): Promise<RawFile[]> {
    if (!watchFolder.id) {
      throw new Error('Watch folder ID is required for network scanning');
    }

    // Ensure connected (mounted)
    await this.connect(watchFolder);

    // Get mount point
    const mountPoint = this.mountedPaths.get(watchFolder.id);
    if (!mountPoint) {
      throw new Error('Network path not mounted');
    }

    // Create a temporary watch folder config with mount point path
    const mountedWatchFolder: WatchFolder = {
      ...watchFolder,
      path: mountPoint
    };

    // Use local provider to scan the mounted path
    return this.localProvider.scan(mountedWatchFolder, options);
  }

  /**
   * Check if a path is already mounted
   * @private
   */
  private async _isMounted(mountPoint: string): Promise<boolean> {
    try {
      // Check /proc/mounts to see if the mount point is already mounted
      const { stdout } = await execAsync(`grep -q "${mountPoint}" /proc/mounts && echo "mounted" || echo "not_mounted"`);
      return stdout.trim() === 'mounted';
    } catch {
      // If grep fails, check if mount point has contents (indicating it's mounted)
      try {
        const entries = await fs.readdir(mountPoint);
        return entries.length > 0;
      } catch {
        return false;
      }
    }
  }

  /**
   * Mount network path using CIFS
   * @private
   */
  private async _mountNetworkPath(watchFolder: WatchFolder): Promise<string | null> {
    if (!watchFolder.id) {
      throw new Error('Watch folder ID is required for network mounting');
    }

    // Mount point: /mnt/network/{watchFolderId}
    const mountPoint = `/mnt/network/${watchFolder.id}`;

    // Check if already mounted on the filesystem
    const alreadyMounted = await this._isMounted(mountPoint);
    if (alreadyMounted) {
      logger.debug('Network path already mounted on filesystem', {
        watchFolderId: watchFolder.id,
        mountPoint
      });
      // Update our tracking map
      this.mountedPaths.set(watchFolder.id, mountPoint);
      return mountPoint;
    }

    // Get decrypted password
    const password = await db.getDecryptedPassword(watchFolder.id);
    if (!password) {
      throw new Error('Password not available for network path');
    }

    // Convert Windows UNC path to SMB path format
    // \\server\share -> //server/share
    let smbPath = watchFolder.path.replace(/\\/g, '/');
    if (!smbPath.startsWith('//')) {
      smbPath = '//' + smbPath.replace(/^\/+/, '');
    }

    try {
      // Create mount point directory
      await fs.mkdir(mountPoint, { recursive: true });

      // Build mount options
      const mountOptions: string[] = [];
      mountOptions.push(`username=${watchFolder.username || ''}`);
      mountOptions.push(`password=${password}`);
      if (watchFolder.domain) {
        mountOptions.push(`domain=${watchFolder.domain}`);
      }
      // Note: Mounting requires root privileges
      // If running as non-root, container needs CAP_SYS_ADMIN or run as root
      // For node user (uid=1000), we still set ownership
      mountOptions.push('uid=1000'); // node user
      mountOptions.push('gid=1000'); // node group
      mountOptions.push('file_mode=0644');
      mountOptions.push('dir_mode=0755');
      mountOptions.push('iocharset=utf8');
      mountOptions.push('noperm'); // Don't check permissions on mount

      const mountCmd = `mount -t cifs "${smbPath}" "${mountPoint}" -o ${mountOptions.join(',')}`;

      logger.info('Mounting network path', {
        watchFolderId: watchFolder.id,
        smbPath,
        mountPoint
      });

      try {
        await execAsync(mountCmd);
        this.mountedPaths.set(watchFolder.id, mountPoint);
        logger.info('Network path mounted successfully', {
          watchFolderId: watchFolder.id,
          mountPoint
        });
        return mountPoint;
      } catch (mountError: any) {
        logger.error('Failed to mount network path', {
          watchFolderId: watchFolder.id,
          error: mountError.message,
          stderr: mountError.stderr
        });
        // Clean up mount point directory if mount failed
        try {
          await fs.rmdir(mountPoint);
        } catch (rmError) {
          // Ignore cleanup errors
        }
        return null;
      }
    } catch (error: any) {
      logger.error('Error preparing network mount', {
        watchFolderId: watchFolder.id,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Unmount network path
   * Public method for manual unmounting
   */
  async unmountNetworkPath(watchFolderId: number): Promise<void> {
    const mountPoint = this.mountedPaths.get(watchFolderId);
    if (!mountPoint) {
      logger.debug('Network path not mounted', { watchFolderId });
      return;
    }

    try {
      logger.info('Unmounting network path', { watchFolderId, mountPoint });
      await execAsync(`umount "${mountPoint}"`);
      this.mountedPaths.delete(watchFolderId);

      // Remove mount point directory
      try {
        await fs.rmdir(mountPoint);
      } catch (rmError) {
        // Ignore cleanup errors
      }

      logger.info('Network path unmounted successfully', { watchFolderId });
    } catch (error: any) {
      logger.error('Failed to unmount network path', {
        watchFolderId,
        mountPoint,
        error: error.message,
        stderr: error.stderr
      });
      // Still remove from map even if unmount failed
      this.mountedPaths.delete(watchFolderId);
    }
  }
}
