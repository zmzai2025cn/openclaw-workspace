/**
 * Main entry point for SilkTalk Pro
 */

export { SilkNode } from './core/node.js';
export { ConfigManager, DEFAULT_CONFIG } from './core/config.js';
export { IdentityManager } from './core/identity.js';
export { Logger, setGlobalLogger, getGlobalLogger } from './core/logger.js';
export { MessageHandler } from './protocol/handler.js';
export { ConnectionManager } from './network/connection-manager.js';
export { TransportManager } from './network/transport-manager.js';
export { NatTraversal } from './network/nat-traversal.js';
export { DHTRouting } from './routing/dht.js';
export { PeerDiscovery } from './routing/discovery.js';
export { OpenClawBridge } from './bridge/openclaw.js';

// Types
export type {
  SilkNodeConfig,
  SilkMessage,
  MessageHeader,
  MessagePayload,
  PeerId,
  Multiaddr,
  Connection,
  Stream,
  PeerInfo,
  ConnectionInfo,
  NetworkInfo,
  HelloPayload,
  TextPayload,
  DataPayload,
  CommandPayload,
  AckPayload,
  ErrorPayload
} from './core/types.js';

export {
  MessageType,
  SilkTalkError,
  ConnectionError,
  ProtocolError,
  ValidationError
} from './core/types.js';

// Version
export const VERSION = '1.0.0';
