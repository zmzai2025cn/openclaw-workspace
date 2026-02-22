/**
 * Main SilkNode implementation with full libp2p integration
 * 
 * FIXES:
 * - Fixed component startup order with proper dependency checking
 * - Fixed event listener cleanup in stop()
 * - Added proper error propagation during startup
 * - Removed @ts-ignore comments with proper type handling
 * - FIXED M1: Added event handler setup guard to prevent duplicate registration
 * - FIXED M2: Fixed component stop order for proper cleanup
 * - FIXED L11: Added IPv6 private address detection
 */

import EventEmitter from 'events';
import { createLibp2p, type Libp2pOptions } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT } from '@libp2p/kad-dht';
import { mdns } from '@libp2p/mdns';
import { bootstrap } from '@libp2p/bootstrap';
import { identify } from '@libp2p/identify';
import { ping } from '@libp2p/ping';
import { circuitRelayTransport, circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { autoNAT } from '@libp2p/autonat';
import { uPnPNAT } from '@libp2p/upnp-nat';
import type { Libp2p } from 'libp2p';
import type { PeerId, Connection } from '@libp2p/interface';
import type { Multiaddr } from '@multiformats/multiaddr';

import type {
  SilkNodeConfig,
  SilkMessage,
  NetworkInfo
} from './types.js';
import { ConfigManager, loadConfigFromEnv } from './config.js';
import { IdentityManager } from './identity.js';
import { Logger, getGlobalLogger } from './logger.js';
import { ConnectionManager } from '../network/connection-manager.js';
import { MessageHandler } from '../protocol/handler.js';
import { PeerDiscovery } from '../routing/discovery.js';
import { DHTRouting } from '../routing/dht.js';
import { NatTraversal } from '../network/nat-traversal.js';
import { ConnectionError } from './types.js';

export interface SilkNodeEvents {
  'peer:connect': (peerId: string) => void;
  'peer:disconnect': (peerId: string) => void;
  'message:received': (message: SilkMessage, peerId: string) => void;
  'message:sent': (messageId: string, peerId: string) => void;
  'error': (error: Error) => void;
  'ready': () => void;
  'stop': () => void;
}

export class SilkNode extends EventEmitter {
  private config: SilkNodeConfig;
  private configManager: ConfigManager;
  private logger: Logger;
  private started = false;
  private libp2p: Libp2p | null = null;
  private identityManager: IdentityManager;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  private peerDiscovery: PeerDiscovery;
  private dhtRouting: DHTRouting;
  private natTraversal: NatTraversal;
  private eventAbortController: AbortController | null = null;
  private starting = false;
  private stopping = false;

  constructor(config?: Partial<SilkNodeConfig>) {
    super();
    
    this.configManager = new ConfigManager();
    this.identityManager = new IdentityManager();
    this.logger = getGlobalLogger().child({ component: 'SilkNode' });
    
    // Merge config from env and constructor
    const envConfig = loadConfigFromEnv();
    this.config = this.configManager.get();
    this.config = { ...this.config, ...envConfig, ...config };
    
    // Initialize components
    this.connectionManager = new ConnectionManager(this.logger, {
      maxConnections: this.config.connection?.maxConnections ?? 300,
      minConnections: this.config.connection?.minConnections ?? 10,
      maxConnectionsPerPeer: this.config.connection?.maxConnectionsPerPeer ?? 5
    });
    
    this.messageHandler = new MessageHandler(this.logger);
    this.peerDiscovery = new PeerDiscovery(this.logger, {
      mdns: this.config.discovery?.mdns ?? true,
      dht: typeof this.config.discovery?.dht === 'boolean' ? this.config.discovery.dht : true,
      bootstrap: this.config.discovery?.bootstrap ?? []
    });
    this.dhtRouting = new DHTRouting(this.logger);
    this.natTraversal = new NatTraversal(this.logger, {
      upnp: this.config.nat?.upnp ?? true,
      autonat: this.config.nat?.autonat ?? true
    });
  }

  async start(): Promise<void> {
    // FIXED M1: Prevent concurrent starts and duplicate event registration
    if (this.starting) {
      this.logger.warn('Node start already in progress');
      return;
    }
    
    if (this.started) {
      this.logger.warn('Node already started');
      return;
    }
    
    this.starting = true;

    try {
      // Load or create identity
      let peerId: PeerId;
      if (this.config.privateKey) {
        peerId = await this.identityManager.loadOrCreate({
          privateKey: this.config.privateKey
        });
      } else {
        peerId = await this.identityManager.loadOrCreate();
      }

      this.logger.info(`Starting SilkNode with peer ID: ${peerId.toString()}`);

      // Build libp2p configuration
      const libp2pConfig = await this.buildLibp2pConfig(peerId);
      
      // Create libp2p node
      this.libp2p = await createLibp2p(libp2pConfig);

      // FIXED M1: Clean up any existing event handlers before setting up new ones
      this.cleanupEventHandlers();
      
      // Set up event handlers BEFORE starting libp2p
      this.setupEventHandlers();

      // Start libp2p first
      await this.libp2p.start();

      // Set up protocol handlers
      await this.messageHandler.setup(this.libp2p, (message, peerId) => {
        this.emit('message:received', message, peerId);
      });

      // Set libp2p references in components that need it
      this.dhtRouting.setLibp2p(this.libp2p);
      this.peerDiscovery.setLibp2p(this.libp2p);
      this.natTraversal.setLibp2p(this.libp2p);

      // Start components that depend on libp2p
      await this.dhtRouting.start();
      await this.peerDiscovery.start();

      // Detect NAT type
      await this.natTraversal.detectNatType();

      this.started = true;
      this.starting = false;
      this.emit('ready');
      
      this.logger.info('SilkNode started successfully');
      this.logger.info(`Listen addresses: ${this.getMultiaddrs().map(a => a.toString()).join(', ')}`);
    } catch (error) {
      this.starting = false;
      this.logger.error(`Failed to start node: ${(error as Error).message}`);
      // Clean up any partial initialization
      await this.cleanup();
      throw error;
    }
  }

  async stop(): Promise<void> {
    // Prevent concurrent stops
    if (this.stopping) {
      this.logger.warn('Node stop already in progress');
      return;
    }
    
    if (!this.started || !this.libp2p) {
      return;
    }
    
    this.stopping = true;

    try {
      this.logger.info('Stopping SilkNode...');
      
      // Remove event listeners first
      this.cleanupEventHandlers();
      
      // FIXED M2: Stop components in reverse order of dependencies
      // DHT depends on discovery, so stop DHT first
      await this.dhtRouting.stop();
      await this.peerDiscovery.stop();
      this.connectionManager.closeAllConnections();
      
      // Stop libp2p
      await this.libp2p.stop();
      this.libp2p = null;
      
      this.started = false;
      this.stopping = false;
      this.emit('stop');
      this.logger.info('SilkNode stopped');
    } catch (error) {
      this.stopping = false;
      this.logger.error(`Error stopping node: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Clean up resources during failed startup
   */
  private async cleanup(): Promise<void> {
    try {
      this.cleanupEventHandlers();
      
      if (this.libp2p) {
        await this.libp2p.stop();
        this.libp2p = null;
      }
      
      this.connectionManager.closeAllConnections();
    } catch (error) {
      this.logger.error(`Error during cleanup: ${(error as Error).message}`);
    }
  }

  isStarted(): boolean {
    return this.started;
  }
  
  isStarting(): boolean {
    return this.starting;
  }
  
  isStopping(): boolean {
    return this.stopping;
  }

  get peerId(): PeerId {
    if (!this.libp2p) {
      throw new Error('Node not started');
    }
    return this.libp2p.peerId;
  }

  getLibp2p(): Libp2p {
    if (!this.libp2p) {
      throw new Error('Node not started');
    }
    return this.libp2p;
  }

  getMultiaddrs(): Multiaddr[] {
    if (!this.libp2p) {
      return [];
    }
    return this.libp2p.getMultiaddrs();
  }

  async dial(multiaddr: string | Multiaddr): Promise<Connection> {
    if (!this.libp2p) {
      throw new Error('Node not started');
    }

    const addr = typeof multiaddr === 'string' ? multiaddr : multiaddr.toString();
    this.logger.debug(`Dialing ${addr}`);

    try {
      const connection = await this.libp2p.dial(multiaddr as Parameters<Libp2p['dial']>[0]);
      this.connectionManager.addConnection(connection.remotePeer.toString(), connection);
      this.emit('peer:connect', connection.remotePeer.toString());
      return connection;
    } catch (error) {
      this.logger.error(`Failed to dial ${addr}: ${(error as Error).message}`);
      throw new ConnectionError(`Failed to dial ${addr}: ${(error as Error).message}`);
    }
  }

  async hangUp(peerId: string | PeerId): Promise<void> {
    if (!this.libp2p) {
      throw new Error('Node not started');
    }

    const id = typeof peerId === 'string' ? peerId : peerId.toString();
    this.logger.debug(`Hanging up ${id}`);
    
    await this.libp2p.hangUp(peerId as Parameters<Libp2p['hangUp']>[0]);
    this.connectionManager.closeConnection(id);
    this.emit('peer:disconnect', id);
  }

  isConnected(peerId: string | PeerId): boolean {
    if (!this.libp2p) {
      return false;
    }
    const id = typeof peerId === 'string' ? peerId : peerId.toString();
    return this.libp2p.getConnections().some(c => c.remotePeer.toString() === id);
  }

  getPeers(): string[] {
    if (!this.libp2p) {
      return [];
    }
    return this.libp2p.getPeers().map(p => p.toString());
  }

  getConnections(): Connection[] {
    if (!this.libp2p) {
      return [];
    }
    return this.libp2p.getConnections();
  }

  async sendMessage(peerId: string | PeerId, message: SilkMessage): Promise<void> {
    if (!this.libp2p) {
      throw new Error('Node not started');
    }

    const id = typeof peerId === 'string' ? peerId : peerId.toString();
    this.logger.debug(`Sending message ${message.header.id} to ${id}`);

    try {
      await this.messageHandler.sendMessage(this.libp2p, peerId, message);
      this.emit('message:sent', message.header.id, id);
    } catch (error) {
      this.logger.error(`Failed to send message to ${id}: ${(error as Error).message}`);
      throw error;
    }
  }

  onMessage(handler: (message: SilkMessage, peerId: string) => void): () => void {
    this.on('message:received', handler);
    return () => {
      this.off('message:received', handler);
    };
  }

  handle(protocol: string, handler: (data: Uint8Array, peerId: string) => Promise<Uint8Array>): void {
    if (!this.libp2p) {
      throw new Error('Node not started');
    }
    
    this.libp2p.handle(protocol, async ({ connection, stream }) => {
      const peerId = connection.remotePeer.toString();
      let streamClosed = false;
      
      const closeStream = async () => {
        if (!streamClosed) {
          streamClosed = true;
          try {
            await stream.close();
          } catch {
            // Ignore close errors
          }
        }
      };
      
      try {
        // Read data from stream
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream.source) {
          chunks.push(chunk.subarray());
        }
        
        const data = Buffer.concat(chunks);
        const response = await handler(data, peerId);
        
        // Write response back
        await stream.sink([response]);
      } catch (error) {
        this.logger.error(`Error handling protocol ${protocol}: ${(error as Error).message}`);
      } finally {
        await closeStream();
      }
    });
    
    this.logger.debug(`Registered handler for protocol: ${protocol}`);
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    const natInfo = this.natTraversal.getNatInfo();
    const multiaddrs = this.getMultiaddrs();
    
    // Separate public and private addresses
    const publicAddresses: string[] = [];
    const privateAddresses: string[] = [];
    
    for (const addr of multiaddrs) {
      const addrStr = addr.toString();
      if (this.isPrivateAddress(addrStr)) {
        privateAddresses.push(addrStr);
      } else {
        publicAddresses.push(addrStr);
      }
    }

    return {
      natType: natInfo.type,
      publicAddresses,
      privateAddresses,
      transports: this.getTransports(),
      relayReservations: [] // Would be populated from relay service
    };
  }
  
  /**
   * Check if an address is private/local
   * FIXED L11: Added IPv6 private address detection
   */
  private isPrivateAddress(addrStr: string): boolean {
    // IPv4 private ranges
    if (addrStr.includes('/ip4/127.') || 
        addrStr.includes('/ip4/192.168.') || 
        addrStr.includes('/ip4/10.') || 
        addrStr.includes('/ip4/172.')) {
      return true;
    }
    
    // FIXED L11: IPv6 private/local addresses
    if (addrStr.includes('/ip6/::1') ||           // Loopback
        addrStr.includes('/ip6/fe80:') ||         // Link-local
        addrStr.includes('/ip6/fc') ||            // Unique local (fc00::/7)
        addrStr.includes('/ip6/fd')) {            // Unique local (fd00::/8)
      return true;
    }
    
    return false;
  }

  // DHT Operations
  async dhtGet(key: string): Promise<Uint8Array | null> {
    return this.dhtRouting.get(key);
  }

  async dhtPut(key: string, value: Uint8Array): Promise<void> {
    await this.dhtRouting.put(key, value);
  }

  // Peer Discovery
  async findPeers(protocol?: string): Promise<Array<{ id: string; addresses: string[] }>> {
    const peers = this.peerDiscovery.getPeers();
    
    if (protocol) {
      return this.peerDiscovery.findPeersByProtocol(protocol).map(p => ({
        id: p.peerId,
        addresses: p.addresses
      }));
    }
    
    return peers.map(p => ({
      id: p.peerId,
      addresses: p.addresses
    }));
  }

  private async buildLibp2pConfig(peerId: PeerId): Promise<Libp2pOptions> {
    const transports = [];
    
    // TCP transport
    if (this.config.transports?.tcp !== false) {
      transports.push(tcp());
    }
    
    // WebSocket transport
    if (this.config.transports?.websocket !== false) {
      transports.push(webSockets());
    }
    
    // Circuit relay transport (always enabled for relay support)
    if (this.config.relay?.enabled !== false) {
      transports.push(circuitRelayTransport());
    }

    // Build listen addresses
    const listenAddresses = this.config.listenAddresses ?? ['/ip4/0.0.0.0/tcp/0'];
    
    // Build services
    const services: Record<string, unknown> = {
      identify: identify(),
      ping: ping()
    };

    // DHT service
    if (this.config.discovery?.dht !== false) {
      services.dht = kadDHT({
        clientMode: false
      });
    }

    // AutoNAT service
    if (this.config.nat?.autonat !== false) {
      services.autoNAT = autoNAT();
    }

    // UPnP NAT service
    if (this.config.nat?.upnp !== false) {
      services.upnpNAT = uPnPNAT();
    }

    // Relay service
    if (this.config.relay?.enabled !== false) {
      services.relay = circuitRelayServer({
        reservations: {
          maxReservations: 100
        }
      });
    }

    // Build peer discovery
    const peerDiscovery = [];
    
    // mDNS discovery
    if (this.config.discovery?.mdns !== false) {
      peerDiscovery.push(mdns());
    }
    
    // Bootstrap discovery
    if (this.config.discovery?.bootstrap && this.config.discovery.bootstrap.length > 0) {
      peerDiscovery.push(bootstrap({
        list: this.config.discovery.bootstrap
      }));
    }

    const addresses: { listen: string[]; announce?: string[] } = {
      listen: listenAddresses
    };
    
    if (this.config.announceAddresses && this.config.announceAddresses.length > 0) {
      addresses.announce = this.config.announceAddresses;
    }

    const config: Libp2pOptions = {
      addresses,
      transports,
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: services as Libp2pOptions['services'],
      peerDiscovery,
      connectionManager: {
        maxConnections: this.config.connection?.maxConnections ?? 300
      }
    };
    
    return config;
  }

  private setupEventHandlers(): void {
    if (!this.libp2p) return;

    this.eventAbortController = new AbortController();
    const signal = this.eventAbortController.signal;

    // Connection events
    this.libp2p.addEventListener('peer:connect', (event) => {
      const peerId = event.detail.toString();
      this.logger.debug(`Peer connected: ${peerId}`);
      this.emit('peer:connect', peerId);
    }, { signal });

    this.libp2p.addEventListener('peer:disconnect', (event) => {
      const peerId = event.detail.toString();
      this.logger.debug(`Peer disconnected: ${peerId}`);
      this.emit('peer:disconnect', peerId);
    }, { signal });

    // Discovery events
    this.libp2p.addEventListener('peer:discovery', (event) => {
      const peerId = event.detail.id.toString();
      const multiaddrs = event.detail.multiaddrs.map((a: Multiaddr) => a.toString());
      this.logger.debug(`Discovered peer: ${peerId}`);
      
      this.peerDiscovery.addPeer({
        type: 'peer',
        peerId,
        addresses: multiaddrs
      });
    }, { signal });
  }

  private cleanupEventHandlers(): void {
    if (this.eventAbortController) {
      this.eventAbortController.abort();
      this.eventAbortController = null;
    }
  }

  private getTransports(): string[] {
    const transports: string[] = [];
    if (this.config.transports?.tcp !== false) transports.push('tcp');
    if (this.config.transports?.websocket !== false) transports.push('websocket');
    if (this.config.relay?.enabled !== false) transports.push('relay');
    return transports;
  }
}
