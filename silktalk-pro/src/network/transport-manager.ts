/**
 * Transport manager for SilkTalk Pro with libp2p integration
 * 
 * FIXED L5: Removed unused initialize method, made class functional
 */

import type { Libp2p } from 'libp2p';
import type { Logger } from '../core/logger.js';

export interface TransportConfig {
  tcp?: boolean | { enabled: boolean; port?: number; host?: string };
  websocket?: boolean | { enabled: boolean; port?: number; secure?: boolean };
}

export interface TransportInfo {
  type: 'tcp' | 'websocket' | 'webrtc' | 'relay';
  listening: boolean;
  addresses: string[];
}

export class TransportManager {
  private logger: Logger;
  private transports: Map<string, TransportInfo> = new Map();
  private config: TransportConfig;
  private libp2p: Libp2p | null = null;
  private isInitialized = false;

  constructor(logger: Logger, config: TransportConfig = {}) {
    this.logger = logger.child({ component: 'TransportManager' });
    this.config = config;
    
    // Initialize transport map based on config
    this.initializeTransports();
  }
  
  /**
   * FIXED L5: Initialize transports from config in constructor
   */
  private initializeTransports(): void {
    // TCP transport
    if (this.isEnabled(this.config.tcp)) {
      this.transports.set('tcp', {
        type: 'tcp',
        listening: false,
        addresses: []
      });
      this.logger.debug('TCP transport enabled');
    }

    // WebSocket transport
    if (this.isEnabled(this.config.websocket)) {
      this.transports.set('websocket', {
        type: 'websocket',
        listening: false,
        addresses: []
      });
      this.logger.debug('WebSocket transport enabled');
    }

    this.isInitialized = true;
    this.logger.info(`Initialized ${this.transports.size} transport(s)`);
  }

  setLibp2p(libp2p: Libp2p): void {
    this.libp2p = libp2p;
    this.syncWithLibp2p();
  }

  private syncWithLibp2p(): void {
    if (!this.libp2p) return;

    // Sync transport info with libp2p's actual state
    const multiaddrs = this.libp2p.getMultiaddrs();
    
    // Reset listening state
    for (const [, info] of this.transports) {
      info.listening = false;
      info.addresses = [];
    }
    
    for (const addr of multiaddrs) {
      const addrStr = addr.toString();
      
      if (addrStr.includes('/tcp/')) {
        if (addrStr.includes('/ws') || addrStr.includes('/wss')) {
          this.updateTransportAddress('websocket', addrStr);
        } else {
          this.updateTransportAddress('tcp', addrStr);
        }
      }
      
      if (addrStr.includes('/p2p-circuit/')) {
        this.updateTransportAddress('relay', addrStr);
      }
    }
  }

  getEnabledTransports(): string[] {
    return Array.from(this.transports.keys());
  }

  getTransportInfo(type: string): TransportInfo | undefined {
    // Sync before returning
    this.syncWithLibp2p();
    return this.transports.get(type);
  }

  getAllTransportInfo(): TransportInfo[] {
    // Sync before returning
    this.syncWithLibp2p();
    return Array.from(this.transports.values());
  }

  updateTransportAddress(type: string, address: string): void {
    const transport = this.transports.get(type);
    if (transport) {
      if (!transport.addresses.includes(address)) {
        transport.addresses.push(address);
        transport.listening = true;
        this.logger.debug(`Added ${type} address: ${address}`);
      }
    } else {
      // Auto-create transport entry for relay
      if (type === 'relay') {
        this.transports.set('relay', {
          type: 'relay',
          listening: true,
          addresses: [address]
        });
        this.logger.debug(`Added relay address: ${address}`);
      }
    }
  }

  removeTransportAddress(type: string, address: string): void {
    const transport = this.transports.get(type);
    if (transport) {
      transport.addresses = transport.addresses.filter(a => a !== address);
      this.logger.debug(`Removed ${type} address: ${address}`);
      
      if (transport.addresses.length === 0) {
        transport.listening = false;
      }
    }
  }

  setTransportListening(type: string, listening: boolean): void {
    const transport = this.transports.get(type);
    if (transport) {
      transport.listening = listening;
      this.logger.debug(`${type} transport listening: ${listening}`);
    }
  }

  isTransportListening(type: string): boolean {
    const transport = this.transports.get(type);
    return transport?.listening ?? false;
  }

  getListenAddresses(): string[] {
    // Sync before returning
    this.syncWithLibp2p();
    
    const addresses: string[] = [];
    
    for (const [, info] of this.transports) {
      if (info.listening) {
        addresses.push(...info.addresses);
      }
    }
    
    return addresses;
  }

  getPreferredTransport(targetAddr: string): string | null {
    // Determine best transport based on target address
    if (targetAddr.includes('/ws') || targetAddr.includes('/wss')) {
      return this.transports.has('websocket') ? 'websocket' : null;
    }
    
    if (targetAddr.includes('/tcp')) {
      return this.transports.has('tcp') ? 'tcp' : null;
    }
    
    if (targetAddr.includes('/p2p-circuit/')) {
      return this.transports.has('relay') ? 'relay' : null;
    }
    
    // Default to TCP if available
    return this.transports.has('tcp') ? 'tcp' : 'websocket';
  }
  
  /**
   * Check if manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Get transport count
   */
  getTransportCount(): number {
    return this.transports.size;
  }
  
  /**
   * Check if a transport type is enabled
   */
  hasTransport(type: string): boolean {
    return this.transports.has(type);
  }

  private isEnabled(config: boolean | { enabled: boolean } | undefined): boolean {
    if (config === undefined) return false;
    if (typeof config === 'boolean') return config;
    return config.enabled;
  }
}
