/**
 * SilkTalk P2P Network Node
 * libp2p wrapper with simplified API
 */

import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { mdns } from '@libp2p/mdns';
import { peerIdFromString } from '@libp2p/peer-id';
import { encode, decode } from '../protocol/message.js';

const PROTOCOL_VERSION = '/silktalk/0.1.0';

export class SilkNode {
  constructor(options = {}) {
    this.name = options.name || 'anonymous';
    this.port = options.port || 0; // 0 = random port
    this.bootstrapPeers = options.bootstrapPeers || [];
    this.node = null;
    this.handlers = new Map();
    this.peers = new Map(); // peerId -> connection info
  }

  /**
   * Start the P2P node
   */
  async start() {
    this.node = await createLibp2p({
      addresses: {
        listen: [`/ip4/0.0.0.0/tcp/${this.port}`]
      },
      transports: [tcp()],
      peerDiscovery: [
        mdns({
          interval: 1000
        })
      ]
    });

    // Set up protocol handler
    this.node.handle(PROTOCOL_VERSION, this._handleProtocol.bind(this));

    // Set up discovery listeners
    this.node.addEventListener('peer:discovery', this._onPeerDiscovered.bind(this));
    this.node.addEventListener('peer:connect', this._onPeerConnected.bind(this));
    this.node.addEventListener('peer:disconnect', this._onPeerDisconnected.bind(this));

    await this.node.start();

    // Connect to bootstrap peers
    for (const addr of this.bootstrapPeers) {
      try {
        // Use dial with multiaddr string directly
        const { multiaddr } = await import('@multiformats/multiaddr');
        const ma = multiaddr(addr);
        await this.node.dial(ma);
        console.log(`[${this.name}] Connected to bootstrap: ${addr}`);
      } catch (err) {
        console.warn(`[${this.name}] Failed to connect to bootstrap: ${addr}`, err.message);
      }
    }

    console.log(`[${this.name}] Started with peerId: ${this.node.peerId.toString()}`);
    console.log(`[${this.name}] Listening on:`, this.node.getMultiaddrs().map(a => a.toString()));

    return this.node.peerId.toString();
  }

  /**
   * Stop the P2P node
   */
  async stop() {
    if (this.node) {
      await this.node.stop();
      console.log(`[${this.name}] Stopped`);
    }
  }

  /**
   * Register message handler
   * @param {string} type - Message type
   * @param {Function} handler - Handler function(msg, connection)
   */
  on(type, handler) {
    this.handlers.set(type, handler);
  }

  /**
   * Send message to a specific peer
   * @param {string} peerIdStr - Target peer ID
   * @param {object} message - Message to send
   */
  async send(peerIdStr, message) {
    const peerId = this._parsePeerId(peerIdStr);
    if (!peerId) {
      throw new Error(`Invalid peerId: ${peerIdStr}`);
    }

    const stream = await this.node.dialProtocol(peerId, PROTOCOL_VERSION);
    try {
      const data = encode(message);
      await stream.sink([data]);
    } finally {
      await stream.close();
    }
  }

  /**
   * Broadcast message to all connected peers
   * @param {object} message - Message to broadcast
   */
  async broadcast(message) {
    const peers = this.node.getPeers();
    console.log(`[${this.name}] Broadcasting to ${peers.length} peers`);

    for (const peerId of peers) {
      try {
        await this.send(peerId.toString(), message);
      } catch (err) {
        console.warn(`[${this.name}] Failed to send to ${peerId}:`, err.message);
      }
    }
  }

  /**
   * Get list of connected peers
   * @returns {string[]} Array of peer IDs
   */
  getPeers() {
    return this.node.getPeers().map(p => p.toString());
  }

  /**
   * Get own peer ID
   * @returns {string} Peer ID
   */
  getPeerId() {
    return this.node.peerId.toString();
  }

  // Private methods

  _parsePeerId(peerIdStr) {
    try {
      return peerIdFromString(peerIdStr);
    } catch {
      return null;
    }
  }

  async _handleProtocol({ stream, connection }) {
    const peerId = connection.remotePeer.toString();

    try {
      // Read all data from stream
      const chunks = [];
      for await (const chunk of stream.source) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks);
      const message = decode(data);

      if (!message) {
        console.warn(`[${this.name}] Received invalid message from ${peerId}`);
        return;
      }

      console.log(`[${this.name}] Received ${message.type} from ${peerId}`);

      // Route to handler
      const handler = this.handlers.get(message.type);
      if (handler) {
        try {
          await handler(message, { peerId, connection });
        } catch (err) {
          console.error(`[${this.name}] Handler error for ${message.type}:`, err.message);
        }
      } else {
        console.warn(`[${this.name}] No handler for message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`[${this.name}] Error handling message from ${peerId}:`, err.message);
    }
  }

  _onPeerDiscovered(event) {
    const peerId = event.detail.id.toString();
    console.log(`[${this.name}] Discovered peer: ${peerId}`);
  }

  _onPeerConnected(event) {
    const peerId = event.detail.toString();
    console.log(`[${this.name}] Connected to: ${peerId}`);
    this.peers.set(peerId, { connectedAt: Date.now() });
  }

  _onPeerDisconnected(event) {
    const peerId = event.detail.toString();
    console.log(`[${this.name}] Disconnected from: ${peerId}`);
    this.peers.delete(peerId);
  }
}
