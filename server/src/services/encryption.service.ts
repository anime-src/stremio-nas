import crypto from 'crypto';
import logger from '../config/logger';

/**
 * Encryption service for sensitive data (passwords)
 * Uses AES-256-GCM encryption
 */
class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 32 bytes for AES-256
  private ivLength = 16; // 16 bytes for GCM
  private tagLength = 16; // 16 bytes for authentication tag

  /**
   * Get encryption key from environment variable
   * @private
   */
  private getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    
    if (!key) {
      logger.error('ENCRYPTION_KEY environment variable is not set');
      throw new Error('Encryption key not configured. Please set ENCRYPTION_KEY environment variable.');
    }

    // Key should be 32 bytes (256 bits) for AES-256
    // If provided as hex string, decode it
    // If provided as base64, decode it
    // Otherwise, use first 32 bytes or pad/truncate
    let keyBuffer: Buffer;
    
    try {
      // Try hex first
      if (key.length === 64) {
        keyBuffer = Buffer.from(key, 'hex');
      } else if (key.length === 44) {
        // Try base64
        keyBuffer = Buffer.from(key, 'base64');
      } else {
        // Use as-is and pad/truncate to 32 bytes
        keyBuffer = Buffer.from(key, 'utf8');
      }
    } catch (error) {
      logger.error('Failed to parse encryption key', { error });
      throw new Error('Invalid encryption key format');
    }

    // Ensure key is exactly 32 bytes
    if (keyBuffer.length !== this.keyLength) {
      if (keyBuffer.length < this.keyLength) {
        // Pad with zeros
        keyBuffer = Buffer.concat([keyBuffer, Buffer.alloc(this.keyLength - keyBuffer.length)]);
      } else {
        // Truncate
        keyBuffer = keyBuffer.slice(0, this.keyLength);
      }
    }

    return keyBuffer;
  }

  /**
   * Encrypt plaintext string
   * @param plaintext - String to encrypt
   * @returns Base64 encoded encrypted string with IV and tag
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    try {
      const key = this.getKey();
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
      
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      // Format: base64(iv:tag:encrypted)
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'base64')
      ]);
      
      return combined.toString('base64');
    } catch (error: any) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted string
   * @param encrypted - Base64 encoded encrypted string with IV and tag
   * @returns Decrypted plaintext string
   */
  decrypt(encrypted: string): string {
    if (!encrypted) {
      return '';
    }

    try {
      const key = this.getKey();
      const combined = Buffer.from(encrypted, 'base64');
      
      // Extract IV, tag, and encrypted data
      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encryptedData = combined.slice(this.ivLength + this.tagLength);
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      if ('setAuthTag' in decipher) {
        (decipher as crypto.DecipherGCM).setAuthTag(tag);
      } else {
        throw new Error('Decipher does not support GCM mode');
      }
      
      let decrypted = decipher.update(encryptedData, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Failed to decrypt data');
    }
  }
}

export default new EncryptionService();
