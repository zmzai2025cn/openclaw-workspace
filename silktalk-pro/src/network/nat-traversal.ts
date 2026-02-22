/**
 * NAT traversal utilities for SilkTalk Pro with libp2p integration
 * 
 * FIXED L6: Return consistent state on detection failure
 */

import type { Libp2p } from 'libp2p';
import type { Logger } from '../core/logger.js';

export type NatType = 'full-cone' | 'restricted' | 'port-restricted' | 'symmetric' | 'unknown';

export interface NatInfo {
  type: NatType;
  publicAddress?: string;
  publicPort?: number;
  supportsUpnp: boolean;
  supportsPmp: boolean;
  detectionTime?: number;
  detectionError?: string;
}

export interface NatTraversalConfig {
  upnp?: boolean;
  autonat?: boolean;
  stun?: boolean;
  turn?: boolean;
  stunServers?: string[];
  turnServers?: Array<{
    url: string;
    username: string;
    credential: string;
  }>;
}

export class NatTraversal {
  private logger: Logger;
  private config: NatTraversalConfig;
  private natInfo: NatInfo;
  private libp2p: Libp2p | null = null;
  private isDetecting = false;

  constructor(logger: Logger, config: NatTraversalConfig = {}) {
    this.logger = logger.child({ component: 'NatTraversal' });
    this.config = {
      upnp: true,
      autonat: true,
      stun: true,
      turn: false,
      stunServers: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
      ],
      ...config
    };
    
    // Initialize with consistent default state
    this.natInfo = this.getDefaultNatInfo();
  }
  
  private getDefaultNatInfo(): NatInfo {
    return {
      type: 'unknown',
      supportsUpnp: false,
      supportsPmp: false
    };
  }

  setLibp2p(libp2p: Libp2p): void {
    this.libp2p = libp2p;
  }

  async detectNatType(): Promise<NatInfo> {
    // Prevent concurrent detection
    if (this.isDetecting) {
      this.logger.debug('NAT detection already in progress');
      return this.natInfo;
    }
    
    this.isDetecting = true;
    this.logger.info('Detecting NAT type');
    
    const startTime = Date.now();

    try {
      // Try UPnP first (most reliable for home routers)
      if (this.config.upnp && this.libp2p) {
        const upnpResult = await this.tryUpnp();
        if (upnpResult) {
          this.natInfo = {
            ...upnpResult,
            detectionTime: Date.now() - startTime
          };
          this.logger.info(`NAT type detected via UPnP: ${this.natInfo.type}`);
          return this.natInfo;
        }
      }

      // Try AutoNAT for detection
      if (this.config.autonat && this.libp2p) {
        const autonatResult = await this.tryAutoNat();
        if (autonatResult) {
          this.natInfo = {
            ...autonatResult,
            detectionTime: Date.now() - startTime
          };
          this.logger.info(`NAT type detected via AutoNAT: ${this.natInfo.type}`);
          return this.natInfo;
        }
      }

      // Could not determine NAT type - return consistent state
      this.logger.warn('Could not determine NAT type');
      this.natInfo = {
        ...this.getDefaultNatInfo(),
        detectionTime: Date.now() - startTime
      };
      return this.natInfo;
    } catch (error) {
      this.logger.error(`Error detecting NAT type: ${(error as Error).message}`);
      // FIXED L6: Return consistent state with error info
      this.natInfo = {
        ...this.getDefaultNatInfo(),
        detectionTime: Date.now() - startTime,
        detectionError: (error as Error).message
      };
      return this.natInfo;
    } finally {
      this.isDetecting = false;
    }
  }

  getNatInfo(): NatInfo {
    return { ...this.natInfo };
  }
  
  /**
   * Get raw NAT info without cloning (for internal use)
   */
  private getNatInfoRef(): NatInfo {
    return this.natInfo;
  }

  isPubliclyReachable(): boolean {
    return this.natInfo.type === 'full-cone' || this.natInfo.type === 'restricted';
  }

  requiresRelay(): boolean {
    return this.natInfo.type === 'symmetric' || this.natInfo.type === 'unknown';
  }

  private async tryUpnp(): Promise<NatInfo | null> {
    if (!this.libp2p) return null;

    try {
      const upnpNAT = (this.libp2p.services as Record<string, unknown>).upnpNAT as 
        { externalAddress?: string; externalPort?: number } | undefined;
      
      if (upnpNAT && upnpNAT.externalAddress) {
        const natInfo: NatInfo = {
          type: 'full-cone',
          publicAddress: upnpNAT.externalAddress,
          supportsUpnp: true,
          supportsPmp: false
        };
        
        if (upnpNAT.externalPort !== undefined) {
          natInfo.publicPort = upnpNAT.externalPort;
        }
        
        return natInfo;
      }
    } catch (error) {
      this.logger.debug(`UPnP detection failed: ${(error as Error).message}`);
    }

    return null;
  }

  private async tryAutoNat(): Promise<NatInfo | null> {
    if (!this.libp2p) return null;

    try {
      const autoNAT = (this.libp2p.services as Record<string, unknown>).autoNAT as 
        { status?: { text?: string } } | undefined;
      
      if (autoNAT) {
        const status = autoNAT.status?.text ?? 'unknown';
        
        // Map AutoNAT status to NAT type
        let natType: NatType = 'unknown';
        
        switch (status) {
          case 'Public':
            natType = 'full-cone';
            break;
          case 'BehindNAT':
            natType = 'restricted';
            break;
          case 'Unknown':
          default:
            natType = 'unknown';
        }
        
        return {
          type: natType,
          supportsUpnp: false,
          supportsPmp: false
        };
      }
    } catch (error) {
      this.logger.debug(`AutoNAT detection failed: ${(error as Error).message}`);
    }

    return null;
  }

  getRecommendedStrategy(): NatStrategy {
    switch (this.natInfo.type) {
      case 'full-cone':
        return {
          directConnection: true,
          useStun: true,
          useTurn: false,
          useRelay: false,
          holePunching: false
        };
      
      case 'restricted':
      case 'port-restricted':
        return {
          directConnection: true,
          useStun: true,
          useTurn: false,
          useRelay: true, // Fallback
          holePunching: true
        };
      
      case 'symmetric':
        return {
          directConnection: false,
          useStun: false,
          useTurn: true,
          useRelay: true,
          holePunching: false
        };
      
      default:
        return {
          directConnection: true,
          useStun: true,
          useTurn: true,
          useRelay: true,
          holePunching: true
        };
    }
  }
  
  /**
   * Check if NAT detection is in progress
   */
  isDetectingNat(): boolean {
    return this.isDetecting;
  }
  
  /**
   * Reset NAT info to default state
   */
  reset(): void {
    this.natInfo = this.getDefaultNatInfo();
    this.isDetecting = false;
  }
}

export interface NatStrategy {
  directConnection: boolean;
  useStun: boolean;
  useTurn: boolean;
  useRelay: boolean;
  holePunching: boolean;
}
