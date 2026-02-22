/**
 * Peer discovery for SilkTalk Pro with libp2p integration
 * 
 * FIXES:
 * - Fixed duplicate interval creation when start() called multiple times
 * - Added proper interval cleanup in stop()
 * - Added error handling for async iterator in discoverViaDht
 * - FIXED M6: Enhanced async iterator exception handling with proper cleanup
 * - FIXED L13: Added LRU cache with size limit to prevent memory growth
 */

import EventEmitter from 'events';
import type { Libp2p } from 'libp2p';
import type { PeerId } from '@libp2p/interface';
import type { Multiaddr } from '@multiformats/multiaddr';
import type { Logger } from '../core/logger.js';

export interface DiscoveryEvent {
  type: 'peer' | 'provider';
  peerId: string;
  addresses: string[];
  protocols?: string[];
  metadata?: Record<string, unknown>;
}

export interface DiscoveryOptions {
  mdns?: boolean;
  dht?: boolean;
  bootstrap?: string[];
  interval?: number;
  maxPeers?: number; // FIXED L13: Added max peers limit
}

interface LRUPeerCache {
  peers: Map<string, DiscoveryEvent>;
  order: string[];
  maxSize: number;
}

export class PeerDiscovery extends EventEmitter {
  private logger: Logger;
  private options: DiscoveryOptions;
  private discoveredPeers: LRUPeerCache;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private libp2p: Libp2p | null = null;
  private abortController: AbortController | null = null;

  constructor(logger: Logger, options: DiscoveryOptions = {}) {
    super();
    this.logger = logger.child({ component: 'PeerDiscovery' });
    this.options = {
      mdns: true,
      dht: true,
      interval: 60000,
      maxPeers: 1000, // FIXED L13: Default max peers
      ...options
    };
    
    // FIXED L13: Initialize LRU cache
    this.discoveredPeers = {
      peers: new Map(),
      order: [],
      maxSize: this.options.maxPeers ?? 1000
    };
  }

  async start(): Promise<void> {
    // Prevent duplicate starts
    if (this.isRunning) {
      this.logger.warn('Peer discovery already running');
      return;
    }

    this.logger.info('Starting peer discovery');
    this.isRunning = true;
    this.abortController = new AbortController();

    // Clear any existing interval first (defensive)
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    // Start periodic discovery
    this.discoveryInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      this.performDiscovery().catch((error: Error) => {
        this.logger.error(`Error during discovery: ${error.message}`);
      });
    }, this.options.interval);

    // Perform initial discovery
    await this.performDiscovery();
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping peer discovery');
    
    this.isRunning = false;

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.discoveredPeers.peers.clear();
    this.discoveredPeers.order = [];
  }

  setLibp2p(libp2p: Libp2p): void {
    this.libp2p = libp2p;
  }

  private async performDiscovery(): Promise<void> {
    if (!this.isRunning || !this.libp2p) {
      return;
    }

    this.logger.debug('Performing peer discovery');

    if (this.options.mdns) {
      await this.discoverViaMdns();
    }

    if (this.options.dht) {
      await this.discoverViaDht();
    }

    if (this.options.bootstrap && this.options.bootstrap.length > 0) {
      await this.discoverViaBootstrap();
    }
  }

  private async discoverViaMdns(): Promise<void> {
    // mDNS discovery is handled by libp2p's mdns service
    // The peer:discovery event will be emitted by libp2p
    this.logger.debug('mDNS discovery enabled');
  }

  private async discoverViaDht(): Promise<void> {
    if (!this.libp2p || !this.abortController) return;

    try {
      // Check if DHT service is available
      const dht = (this.libp2p.services as Record<string, unknown>).dht as 
        { getClosestPeers?: (peerId: PeerId, options?: { signal?: AbortSignal }) => AsyncIterable<{ id: PeerId; multiaddrs: Multiaddr[] }> } | undefined;
      
      if (dht && dht.getClosestPeers) {
        this.logger.debug('Performing DHT discovery');
        
        // FIXED M6: Enhanced exception handling with abort signal
        try {
          const signal = this.abortController.signal;
          
          // Get closest peers from DHT with timeout
          const timeoutPromise = new Promise<void>((_, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('DHT discovery timeout'));
            }, 30000);
            
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('DHT discovery aborted'));
            });
          });
          
          const discoveryPromise = (async () => {
            const closestPeers = await dht.getClosestPeers!(this.libp2p!.peerId, { signal });
            
            for await (const peer of closestPeers) {
              // Check if aborted
              if (signal.aborted) break;
              
              try {
                this.addPeer({
                  type: 'peer',
                  peerId: peer.id.toString(),
                  addresses: peer.multiaddrs.map(a => a.toString())
                });
              } catch (peerError) {
                this.logger.debug(`Error processing peer: ${(peerError as Error).message}`);
              }
            }
          })();
          
          // Race between timeout and discovery
          await Promise.race([discoveryPromise, timeoutPromise]).catch((error) => {
            if (error.message !== 'DHT discovery aborted') {
              this.logger.debug(`DHT discovery ended: ${error.message}`);
            }
          });
          
        } catch (iteratorError) {
          this.logger.debug(`DHT iteration error: ${(iteratorError as Error).message}`);
        }
      }
    } catch (error) {
      this.logger.debug(`DHT discovery failed: ${(error as Error).message}`);
    }
  }

  private async discoverViaBootstrap(): Promise<void> {
    if (!this.options.bootstrap) return;

    for (const addr of this.options.bootstrap) {
      this.logger.debug(`Bootstrap peer: ${addr}`);
      // Bootstrap discovery is handled by libp2p's bootstrap service
      // The peer:discovery event will be emitted by libp2p
    }
  }

  /**
   * Find providers for a given content hash
   */
  async findProviders(contentHash: string): Promise<DiscoveryEvent[]> {
    if (!this.libp2p || !this.abortController) {
      return [];
    }

    try {
      const dht = (this.libp2p.services as Record<string, unknown>).dht as 
        { findProviders?: (cid: Uint8Array, options?: { signal?: AbortSignal }) => AsyncIterable<{ id: PeerId; multiaddrs: Multiaddr[] }> } | undefined;
      
      if (dht && dht.findProviders) {
        const providers: DiscoveryEvent[] = [];
        const hashBytes = new TextEncoder().encode(contentHash);
        const signal = this.abortController.signal;
        
        try {
          // FIXED M6: Enhanced exception handling
          const timeoutPromise = new Promise<void>((_, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Find providers timeout'));
            }, 30000);
            
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Find providers aborted'));
            });
          });
          
          const findPromise = (async () => {
            for await (const provider of dht.findProviders!(hashBytes, { signal })) {
              if (signal.aborted) break;
              
              try {
                providers.push({
                  type: 'provider',
                  peerId: provider.id.toString(),
                  addresses: provider.multiaddrs.map(a => a.toString())
                });
              } catch (providerError) {
                this.logger.debug(`Error processing provider: ${(providerError as Error).message}`);
              }
            }
          })();
          
          await Promise.race([findPromise, timeoutPromise]).catch((error) => {
            if (error.message !== 'Find providers aborted') {
              this.logger.debug(`Find providers ended: ${error.message}`);
            }
          });
          
          return providers;
        } catch (iteratorError) {
          this.logger.debug(`Find providers iteration error: ${(iteratorError as Error).message}`);
        }
      }
    } catch (error) {
      this.logger.debug(`Find providers failed: ${(error as Error).message}`);
    }

    return [];
  }

  /**
   * Announce as a provider for a content hash
   */
  async provide(contentHash: string): Promise<void> {
    if (!this.libp2p) {
      return;
    }

    try {
      const dht = (this.libp2p.services as Record<string, unknown>).dht as 
        { provide?: (cid: Uint8Array) => Promise<void> } | undefined;
      
      if (dht && dht.provide) {
        const hashBytes = new TextEncoder().encode(contentHash);
        await dht.provide(hashBytes);
        this.logger.debug(`Announced as provider for: ${contentHash}`);
      }
    } catch (error) {
      this.logger.debug(`Provide failed: ${(error as Error).message}`);
    }
  }

  /**
   * Add a discovered peer
   * FIXED L13: LRU eviction when cache is full
   */
  addPeer(event: DiscoveryEvent): void {
    const existing = this.discoveredPeers.peers.get(event.peerId);
    
    if (existing) {
      // Update existing peer - move to end of order
      const index = this.discoveredPeers.order.indexOf(event.peerId);
      if (index > -1) {
        this.discoveredPeers.order.splice(index, 1);
      }
      this.discoveredPeers.order.push(event.peerId);
      
      // Merge addresses
      const mergedAddresses = [...new Set([...existing.addresses, ...event.addresses])];
      existing.addresses = mergedAddresses;
      
      // Update metadata
      if (event.metadata) {
        existing.metadata = { ...existing.metadata, ...event.metadata };
      }
      
      // Update protocols
      if (event.protocols) {
        existing.protocols = event.protocols;
      }
      
      this.discoveredPeers.peers.set(event.peerId, existing);
    } else {
      // FIXED L13: Check if we need to evict
      if (this.discoveredPeers.peers.size >= this.discoveredPeers.maxSize) {
        // Remove oldest peer
        const oldestPeerId = this.discoveredPeers.order.shift();
        if (oldestPeerId) {
          this.discoveredPeers.peers.delete(oldestPeerId);
          this.logger.debug(`Evicted oldest peer from cache: ${oldestPeerId}`);
        }
      }
      
      this.discoveredPeers.peers.set(event.peerId, event);
      this.discoveredPeers.order.push(event.peerId);
      this.emit('peer', event);
      this.logger.debug(`Discovered new peer: ${event.peerId}`);
    }
  }

  /**
   * Remove a discovered peer
   */
  removePeer(peerId: string): boolean {
    const existed = this.discoveredPeers.peers.has(peerId);
    this.discoveredPeers.peers.delete(peerId);
    
    const index = this.discoveredPeers.order.indexOf(peerId);
    if (index > -1) {
      this.discoveredPeers.order.splice(index, 1);
    }
    
    if (existed) {
      this.logger.debug(`Removed peer from discovery: ${peerId}`);
    }
    
    return existed;
  }

  /**
   * Get all discovered peers
   */
  getPeers(): DiscoveryEvent[] {
    return Array.from(this.discoveredPeers.peers.values());
  }

  /**
   * Get a specific peer
   */
  getPeer(peerId: string): DiscoveryEvent | undefined {
    return this.discoveredPeers.peers.get(peerId);
  }

  /**
   * Check if a peer has been discovered
   */
  hasPeer(peerId: string): boolean {
    return this.discoveredPeers.peers.has(peerId);
  }

  /**
   * Get peer count
   */
  getPeerCount(): number {
    return this.discoveredPeers.peers.size;
  }

  /**
   * Find peers supporting a specific protocol
   */
  findPeersByProtocol(protocol: string): DiscoveryEvent[] {
    return this.getPeers().filter(peer => 
      peer.protocols?.includes(protocol)
    );
  }

  /**
   * Clear all discovered peers
   */
  clear(): void {
    this.discoveredPeers.peers.clear();
    this.discoveredPeers.order = [];
    this.logger.debug('Cleared all discovered peers');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.discoveredPeers.peers.size,
      maxSize: this.discoveredPeers.maxSize,
      utilization: this.discoveredPeers.peers.size / this.discoveredPeers.maxSize
    };
  }
}
