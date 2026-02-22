/**
 * Core types and interfaces for SilkTalk Pro
 */

import type { PeerId as Libp2pPeerId } from '@libp2p/interface';
import type { Multiaddr as Libp2pMultiaddr } from '@multiformats/multiaddr';
import type { Connection as Libp2pConnection, Stream as Libp2pStream } from '@libp2p/interface';

// Re-export libp2p types
export type PeerId = Libp2pPeerId;
export type Multiaddr = Libp2pMultiaddr;
export type Connection = Libp2pConnection;
export type Stream = Libp2pStream;

export enum MessageType {
  HELLO = 0,
  TEXT = 1,
  DATA = 2,
  COMMAND = 3,
  ACK = 4,
  ERROR = 5
}

export interface MessageHeader {
  version: number;
  type: MessageType;
  id: string;
  timestamp: number;
  sender: string;
  recipient?: string | undefined;
}

export interface HelloPayload {
  clientVersion: string;
  capabilities: string[];
  nonce: string;
}

export interface TextPayload {
  content: string;
  encoding: 'utf-8';
}

export interface DataPayload {
  mimeType: string;
  size: number;
  data: Uint8Array;
  chunk?: {
    index: number;
    total: number;
  };
}

export interface CommandPayload {
  command: string;
  args: Record<string, unknown>;
}

export interface AckPayload {
  messageId: string;
  status: 'received' | 'processed' | 'failed';
  details?: string;
}

export interface ErrorPayload {
  code: number;
  message: string;
  retryable: boolean;
}

export type MessagePayload =
  | HelloPayload
  | TextPayload
  | DataPayload
  | CommandPayload
  | AckPayload
  | ErrorPayload;

export interface SilkMessage {
  header: MessageHeader;
  payload: MessagePayload;
  metadata?: Record<string, unknown> | undefined;
}

export interface SilkNodeConfig {
  // Identity
  privateKey?: Uint8Array;

  // Network
  listenAddresses?: string[];
  announceAddresses?: string[];

  // Transports
  transports?: {
    tcp?: boolean | TcpConfig;
    websocket?: boolean | WsConfig;
  };

  // NAT Traversal
  nat?: {
    upnp?: boolean;
    autonat?: boolean;
    dcutr?: boolean;
  };

  // Relay
  relay?: {
    enabled?: boolean;
    hop?: {
      enabled?: boolean;
      active?: boolean;
    };
    autoRelay?: {
      enabled?: boolean;
      maxListeners?: number;
    };
  };

  // Discovery
  discovery?: {
    mdns?: boolean;
    dht?: boolean | DHTConfig;
    bootstrap?: string[];
  };

  // Connection
  connection?: {
    maxConnections?: number;
    minConnections?: number;
    maxConnectionsPerPeer?: number;
  };

  // Logging
  logging?: {
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    pretty?: boolean;
  };
}

export interface TcpConfig {
  enabled: boolean;
  bindOptions?: {
    port?: number;
    host?: string;
  };
}

export interface WsConfig {
  enabled: boolean;
  filter?: MultiaddrFilter;
}

export interface DHTConfig {
  enabled: boolean;
  clientMode?: boolean;
  validators?: Record<string, DHTValidator>;
  selectors?: Record<string, DHTSelector>;
}

export interface DHTValidator {
  validate(key: Uint8Array, value: Uint8Array): Promise<void>;
  select(key: Uint8Array, values: Uint8Array[]): number;
}

export interface DHTSelector {
  select(key: Uint8Array, values: Uint8Array[]): number;
}

export type MultiaddrFilter = (multiaddr: Multiaddr) => boolean;

export interface PeerInfo {
  id: string;
  addresses: string[];
  protocols: string[];
  metadata?: Record<string, unknown>;
}

export interface ConnectionInfo {
  peerId: string;
  direction: 'inbound' | 'outbound';
  transports: string[];
  latency: number;
  established: Date;
}

export interface NetworkInfo {
  natType: 'full-cone' | 'restricted' | 'port-restricted' | 'symmetric' | 'unknown';
  publicAddresses: string[];
  privateAddresses: string[];
  transports: string[];
  relayReservations: string[];
}

export interface NodeEvents {
  'peer:connect': (peerId: string) => void;
  'peer:disconnect': (peerId: string) => void;
  'message:received': (message: SilkMessage, peerId: string) => void;
  'message:sent': (messageId: string, peerId: string) => void;
  'error': (error: Error) => void;
  'ready': () => void;
  'stop': () => void;
}

export class SilkTalkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'SilkTalkError';
  }
}

export class ConnectionError extends SilkTalkError {
  constructor(message: string, retryable = true) {
    super(message, 'CONNECTION_FAILED', retryable);
    this.name = 'ConnectionError';
  }
}

export class ProtocolError extends SilkTalkError {
  constructor(message: string) {
    super(message, 'PROTOCOL_ERROR', false);
    this.name = 'ProtocolError';
  }
}

export class ValidationError extends SilkTalkError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', false);
    this.name = 'ValidationError';
  }
}

// libp2p specific types
export interface Libp2pServices {
  identify: unknown;
  ping: unknown;
  dht?: unknown;
  autoNAT?: unknown;
  upnpNAT?: unknown;
  relay?: unknown;
  pubsub?: unknown;
}

export interface Libp2pConfig {
  peerId?: PeerId;
  addresses: {
    listen: string[];
    announce?: string[];
  };
  transports: unknown[];
  connectionEncrypters: unknown[];
  streamMuxers: unknown[];
  services?: Record<string, unknown>;
  peerDiscovery?: unknown[];
  connectionManager?: {
    maxConnections?: number;
    minConnections?: number;
    maxConnectionsPerPeer?: number;
  };
  relay?: {
    enabled?: boolean;
    hop?: {
      enabled?: boolean;
      active?: boolean;
    };
    autoRelay?: {
      enabled?: boolean;
      maxListeners?: number;
    };
  };
}
