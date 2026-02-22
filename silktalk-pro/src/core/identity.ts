/**
 * Identity management for SilkTalk Pro with libp2p integration
 * 
 * SECURITY FIXES:
 * - Fixed private key storage to properly persist the actual libp2p key
 * - Added file permission restrictions (0o600) for private key file
 * - Fixed createPeerIdFromPrivateKey to properly import existing keys
 * - FIXED H1: Removed circular dependency by using peerIdFromKeys directly
 * - FIXED L4: Added atomic file write to prevent race conditions
 */

import { readFile, writeFile, mkdir, chmod, rename, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf } from '@libp2p/crypto/keys';
import type { PeerId, PrivateKey } from '@libp2p/interface';

export interface IdentityOptions {
  privateKey?: Uint8Array;
  keyPath?: string;
}

export class IdentityManager {
  private peerId: PeerId | null = null;
  private privateKey: PrivateKey | null = null;
  private keyPath: string;
  private isLoading = false;

  constructor(keyPath?: string) {
    this.keyPath = keyPath ?? join(homedir(), '.silktalk', 'identity.key');
  }

  async loadOrCreate(options: IdentityOptions = {}): Promise<PeerId> {
    // Prevent concurrent loading
    if (this.isLoading) {
      throw new Error('Identity loading already in progress');
    }
    
    this.isLoading = true;
    
    try {
      // Use provided private key if available
      if (options.privateKey) {
        return await this.importPrivateKey(options.privateKey);
      }

      // Try to load from file
      if (existsSync(this.keyPath)) {
        try {
          const keyData = await readFile(this.keyPath);
          return await this.importPrivateKey(new Uint8Array(keyData));
        } catch (error) {
          throw new Error(`Failed to load identity from ${this.keyPath}: ${(error as Error).message}`);
        }
      }

      // Create new identity
      return await this.createNewIdentity();
    } finally {
      this.isLoading = false;
    }
  }

  async createNewIdentity(): Promise<PeerId> {
    try {
      // Generate a new Ed25519 key pair
      const privateKey = await generateKeyPair('Ed25519');
      this.privateKey = privateKey;
      
      // Get peerId from the private key - FIXED H1: Use peerIdFromKeys directly
      const peerId = await this.createPeerIdFromPrivateKey(privateKey);
      this.peerId = peerId;
      
      // Serialize and save the private key
      const keyBytes = privateKeyToProtobuf(privateKey);
      
      // Ensure directory exists
      const dir = dirname(this.keyPath);
      await mkdir(dir, { recursive: true });
      
      // FIXED L4: Atomic file write to prevent race conditions
      const tempPath = `${this.keyPath}.tmp`;
      await writeFile(tempPath, keyBytes, { mode: 0o600 });
      await chmod(tempPath, 0o600);
      await rename(tempPath, this.keyPath);
      
      // Double-check permissions
      await chmod(this.keyPath, 0o600);
      
      return peerId;
    } catch (error) {
      // Clean up temp file if exists
      try {
        const tempPath = `${this.keyPath}.tmp`;
        if (existsSync(tempPath)) {
          await unlink(tempPath);
        }
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to create new identity: ${(error as Error).message}`);
    }
  }

  private async importPrivateKey(keyData: Uint8Array): Promise<PeerId> {
    try {
      // Validate key data
      if (!keyData || keyData.length === 0) {
        throw new Error('Empty key data provided');
      }
      
      // Import the private key from protobuf format
      const privateKey = privateKeyFromProtobuf(keyData);
      this.privateKey = privateKey;
      
      // Get peerId from the private key - FIXED H1: Use peerIdFromKeys directly
      const peerId = await this.createPeerIdFromPrivateKey(privateKey);
      this.peerId = peerId;
      
      return peerId;
    } catch (error) {
      throw new Error(`Failed to import private key: ${(error as Error).message}`);
    }
  }

  private async createPeerIdFromPrivateKey(privateKey: PrivateKey): Promise<PeerId> {
    // FIXED H1: Create PeerId directly from private key
    const { peerIdFromPrivateKey } = await import('@libp2p/peer-id');
    return peerIdFromPrivateKey(privateKey);
  }

  getPeerId(): PeerId {
    if (!this.peerId) {
      throw new Error('Identity not loaded. Call loadOrCreate() first.');
    }
    return this.peerId;
  }

  getPrivateKey(): Uint8Array {
    if (!this.privateKey) {
      throw new Error('Identity not loaded. Call loadOrCreate() first.');
    }
    return privateKeyToProtobuf(this.privateKey);
  }

  async exportToPath(path: string): Promise<void> {
    if (!this.privateKey) {
      throw new Error('Identity not loaded');
    }
    
    const keyBytes = privateKeyToProtobuf(this.privateKey);
    
    // Ensure directory exists
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    
    // Atomic write
    const tempPath = `${path}.tmp`;
    await writeFile(tempPath, keyBytes, { mode: 0o600 });
    await chmod(tempPath, 0o600);
    await rename(tempPath, path);
    await chmod(path, 0o600);
  }

  getKeyPath(): string {
    return this.keyPath;
  }
  
  /**
   * Check if identity is loaded
   */
  isLoaded(): boolean {
    return this.peerId !== null && this.privateKey !== null;
  }
  
  /**
   * Clear loaded identity (for testing or reset)
   */
  clear(): void {
    this.peerId = null;
    this.privateKey = null;
  }
}
