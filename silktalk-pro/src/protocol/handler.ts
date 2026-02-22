/**
 * Protocol message handler for SilkTalk Pro with libp2p integration
 * 
 * FIXES:
 * - Fixed stream not being closed on error (using try-finally)
 * - Fixed message ID collision risk with UUID-based generation
 * - Fixed callback error handling with event emitter
 * - Added proper stream resource cleanup
 * - FIXED H2: Added proper stream cleanup in all paths
 * - FIXED M5: Added node prefix to message ID to prevent collision
 * - FIXED L8: Added option to throw on ACK failure
 */

import EventEmitter from 'events';
import * as lp from 'it-length-prefixed';
import type { Libp2p } from 'libp2p';
import type { PeerId } from '@libp2p/interface';
import type { Logger } from '../core/logger.js';
import type { SilkMessage, MessagePayload } from '../core/types.js';
import { MessageType, ProtocolError, ValidationError } from '../core/types.js';
import { randomUUID } from 'crypto';

const PROTOCOL_ID = '/silktalk/1.0.0/messages';

interface MessageHandlerEvents {
  'message:received': (message: SilkMessage, peerId: string) => void;
  'message:error': (error: Error, peerId: string) => void;
  'message:ack_failed': (messageId: string, peerId: string, error: Error) => void;
}

export declare interface MessageHandler {
  on<U extends keyof MessageHandlerEvents>(
    event: U,
    listener: MessageHandlerEvents[U]
  ): this;
  emit<U extends keyof MessageHandlerEvents>(
    event: U,
    ...args: Parameters<MessageHandlerEvents[U]>
  ): boolean;
}

interface MessageHandlerOptions {
  throwOnAckFailure?: boolean;
  maxMessageSize?: number;
}

export class MessageHandler extends EventEmitter {
  private logger: Logger;
  private messageCallbacks: Array<(message: SilkMessage, peerId: string) => void> = [];
  private libp2p: Libp2p | null = null;
  private messageIdCounter = 0;
  private nodeId: string = '';
  private options: MessageHandlerOptions;
  private isSetup = false;

  constructor(logger: Logger, options: MessageHandlerOptions = {}) {
    super();
    this.logger = logger.child({ component: 'MessageHandler' });
    this.options = {
      throwOnAckFailure: false,
      maxMessageSize: 10 * 1024 * 1024, // 10MB default
      ...options
    };
  }

  async setup(libp2p: Libp2p, onMessage: (message: SilkMessage, peerId: string) => void): Promise<void> {
    // Prevent duplicate setup
    if (this.isSetup) {
      this.logger.warn('MessageHandler already set up');
      return;
    }
    
    this.libp2p = libp2p;
    this.nodeId = libp2p.peerId.toString();
    this.messageCallbacks.push(onMessage);

    const self = this;

    // Register protocol handler
    await libp2p.handle(PROTOCOL_ID, async ({ connection, stream }) => {
      const peerId = connection.remotePeer.toString();
      let streamClosed = false;
      
      // FIXED H2: Ensure stream is always closed
      const closeStream = async () => {
        if (!streamClosed) {
          streamClosed = true;
          try {
            await stream.close();
          } catch (closeError) {
            self.logger.debug(`Error closing stream: ${(closeError as Error).message}`);
          }
        }
      };
      
      try {
        const decoded = lp.decode(stream.source);
        
        for await (const msg of decoded) {
          try {
            // Check message size
            const msgSize = msg.subarray().length;
            if (msgSize > (self.options.maxMessageSize ?? 10 * 1024 * 1024)) {
              throw new ValidationError(`Message too large: ${msgSize} bytes`);
            }
            
            const message = self.decodeMessage(msg.subarray());
            self.validateMessage(message);
            
            self.logger.debug(`Received message ${message.header.id} from ${peerId}`);
            
            // Notify all callbacks
            for (const callback of self.messageCallbacks) {
              try {
                callback(message, peerId);
              } catch (error) {
                self.logger.error(`Error in message callback: ${(error as Error).message}`);
                self.emit('message:error', error as Error, peerId);
              }
            }
            
            // Send ACK if requested
            if (message.header.type !== MessageType.ACK) {
              await self.sendAck(connection.remotePeer, message.header.id);
            }
          } catch (error) {
            self.logger.error(`Error processing message: ${(error as Error).message}`);
            self.emit('message:error', error as Error, peerId);
          }
        }
      } catch (error) {
        self.logger.error(`Error in protocol handler: ${(error as Error).message}`);
        self.emit('message:error', error as Error, peerId);
      } finally {
        // FIXED H2: Always close stream
        await closeStream();
      }
    });

    this.isSetup = true;
    this.logger.info(`Registered protocol handler for ${PROTOCOL_ID}`);
  }

  async sendMessage(libp2p: Libp2p, peerId: PeerId | string, message: SilkMessage): Promise<void> {
    const targetPeerId = typeof peerId === 'string' ? peerId : peerId.toString();
    
    this.logger.debug(`Sending message ${message.header.id} to ${targetPeerId}`);

    // Open a stream to the peer
    const stream = await libp2p.dialProtocol(peerId as Parameters<Libp2p['dialProtocol']>[0], PROTOCOL_ID);
    let streamClosed = false;
    
    const closeStream = async () => {
      if (!streamClosed) {
        streamClosed = true;
        try {
          await stream.close();
        } catch (closeError) {
          this.logger.debug(`Error closing stream: ${(closeError as Error).message}`);
        }
      }
    };
    
    try {
      // Encode and send message
      const encoded = this.encodeMessage(message);
      
      // Check encoded size
      if (encoded.length > (this.options.maxMessageSize ?? 10 * 1024 * 1024)) {
        throw new ValidationError(`Encoded message too large: ${encoded.length} bytes`);
      }
      
      // Write encoded message to stream
      await stream.sink([encoded]);
      
      this.logger.debug(`Sent message ${message.header.id} to ${targetPeerId}`);
    } catch (error) {
      this.logger.error(`Failed to send message to ${targetPeerId}: ${(error as Error).message}`);
      throw new Error(`Failed to send message: ${(error as Error).message}`);
    } finally {
      // FIXED H2: Always close the stream, even if sink failed
      await closeStream();
    }
  }

  private async sendAck(peerId: PeerId, messageId: string): Promise<void> {
    if (!this.libp2p) return;

    try {
      const ackMessage: SilkMessage = {
        header: {
          version: 1,
          type: MessageType.ACK,
          id: this.generateMessageId(),
          timestamp: Date.now(),
          sender: this.libp2p.peerId.toString()
        },
        payload: {
          messageId,
          status: 'received'
        }
      };

      await this.sendMessage(this.libp2p, peerId, ackMessage);
    } catch (error) {
      this.logger.debug(`Failed to send ACK: ${(error as Error).message}`);
      this.emit('message:ack_failed', messageId, peerId.toString(), error as Error);
      
      // FIXED L8: Optionally throw on ACK failure
      if (this.options.throwOnAckFailure) {
        throw error;
      }
    }
  }

  encodeMessage(message: SilkMessage): Uint8Array {
    const data = {
      header: {
        ...message.header,
        recipient: message.header.recipient ?? null
      },
      payload: message.payload,
      metadata: message.metadata ?? null
    };
    return new TextEncoder().encode(JSON.stringify(data));
  }

  decodeMessage(data: Uint8Array): SilkMessage {
    try {
      // Check data size
      if (data.length > (this.options.maxMessageSize ?? 10 * 1024 * 1024)) {
        throw new ProtocolError(`Message data too large: ${data.length} bytes`);
      }
      
      const decoded = JSON.parse(new TextDecoder().decode(data)) as {
        header: { version: number; type: number; id: string; timestamp: number; sender: string; recipient?: string };
        payload: unknown;
        metadata?: Record<string, unknown>;
      };

      return {
        header: {
          version: decoded.header.version,
          type: decoded.header.type as MessageType,
          id: decoded.header.id,
          timestamp: decoded.header.timestamp,
          sender: decoded.header.sender,
          recipient: decoded.header.recipient
        },
        payload: decoded.payload as MessagePayload,
        metadata: decoded.metadata
      };
    } catch (error) {
      if (error instanceof ProtocolError) {
        throw error;
      }
      throw new ProtocolError(`Failed to decode message: ${(error as Error).message}`);
    }
  }

  validateMessage(message: SilkMessage): void {
    // Validate version
    if (message.header.version !== 1) {
      throw new ValidationError(`Unsupported protocol version: ${message.header.version}`);
    }

    // Validate message type
    if (!Object.values(MessageType).includes(message.header.type)) {
      throw new ValidationError(`Invalid message type: ${message.header.type}`);
    }

    // Validate message ID
    if (!message.header.id || typeof message.header.id !== 'string') {
      throw new ValidationError('Invalid message ID');
    }

    // Validate timestamp (within 5 minutes)
    const now = Date.now();
    const messageTime = message.header.timestamp;
    if (Math.abs(now - messageTime) > 5 * 60 * 1000) {
      throw new ValidationError('Message timestamp out of acceptable range');
    }

    // Validate sender
    if (!message.header.sender || typeof message.header.sender !== 'string') {
      throw new ValidationError('Invalid sender');
    }
    
    // Validate payload exists
    if (!message.payload) {
      throw new ValidationError('Missing message payload');
    }
  }

  /**
   * Generate a unique message ID using UUID v4 with node prefix and counter
   * FIXED M5: Added node prefix to prevent collision in distributed environment
   */
  private generateMessageId(): string {
    const uuid = randomUUID();
    const counter = ++this.messageIdCounter;
    const nodePrefix = this.nodeId ? this.nodeId.slice(0, 8) : 'local';
    return `${nodePrefix}-${uuid}-${counter}`;
  }
  
  /**
   * Check if handler is set up
   */
  isSetupComplete(): boolean {
    return this.isSetup;
  }
  
  /**
   * Remove a message callback
   */
  removeCallback(onMessage: (message: SilkMessage, peerId: string) => void): boolean {
    const index = this.messageCallbacks.indexOf(onMessage);
    if (index > -1) {
      this.messageCallbacks.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Clear all callbacks
   */
  clearCallbacks(): void {
    this.messageCallbacks = [];
  }
}
