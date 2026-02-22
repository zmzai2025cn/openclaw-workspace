/**
 * OpenClaw Bridge for SilkTalk Pro
 * Provides integration with OpenClaw agent system
 * 
 * FIXES:
 * - Added input validation for command arguments
 * - Added sanitization to prevent command injection
 * - Fixed argument parsing to handle edge cases
 * - FIXED M7: Enhanced command validation and sandboxing
 * - FIXED L9: Added recursion depth limit for argument sanitization
 */

import EventEmitter from 'events';
import type { SilkNode } from '../core/node.js';
import type { Logger } from '../core/logger.js';
import type { SilkMessage, CommandPayload } from '../core/types.js';
import { MessageType } from '../core/types.js';

export interface BridgeConfig {
  enabled: boolean;
  commandPrefix?: string;
  allowRemoteCommands?: boolean;
  authorizedPeers?: string[];
  maxRecursionDepth?: number; // FIXED L9: Configurable recursion depth
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Valid command name pattern (alphanumeric, hyphen, underscore)
const VALID_COMMAND_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Maximum argument key/value lengths
const MAX_ARG_KEY_LENGTH = 64;
const MAX_ARG_VALUE_LENGTH = 1024;
const MAX_ARRAY_LENGTH = 100;

// FIXED L9: Default maximum recursion depth
const DEFAULT_MAX_RECURSION_DEPTH = 5;

// FIXED M7: Additional dangerous patterns to check
const DANGEROUS_PATTERNS = [
  /[;&|`$]/,           // Shell metacharacters
  /\$\{.*\}/,          // Template literals
  /__proto__/,         // Prototype pollution
  /constructor/,       // Constructor access
  /prototype/,         // Prototype access
];

export class OpenClawBridge extends EventEmitter {
  private node: SilkNode;
  private logger: Logger;
  private config: BridgeConfig;
  private commandHandlers: Map<string, (args: Record<string, unknown>) => Promise<CommandResult>> = new Map();
  private unsubscribeMessageHandler: (() => void) | null = null;
  private running = false;

  constructor(node: SilkNode, logger: Logger, config: BridgeConfig) {
    super();
    this.node = node;
    this.logger = logger.child({ component: 'OpenClawBridge' });
    this.config = {
      commandPrefix: '/cmd',
      allowRemoteCommands: false,
      maxRecursionDepth: DEFAULT_MAX_RECURSION_DEPTH,
      ...config
    };

    this.registerDefaultCommands();
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Bridge already running');
      return;
    }
    
    if (!this.config.enabled) {
      this.logger.debug('Bridge disabled, not starting');
      return;
    }

    this.logger.info('Starting OpenClaw Bridge');
    this.running = true;

    // Listen for incoming messages
    this.unsubscribeMessageHandler = this.node.onMessage((message, peerId) => {
      this.handleMessage(message, peerId).catch((error) => {
        this.logger.error(`Error handling message: ${(error as Error).message}`);
      });
    });
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping OpenClaw Bridge');
    
    this.running = false;
    
    if (this.unsubscribeMessageHandler) {
      this.unsubscribeMessageHandler();
      this.unsubscribeMessageHandler = null;
    }
    
    this.removeAllListeners();
  }

  registerCommand(
    name: string, 
    handler: (args: Record<string, unknown>) => Promise<CommandResult>
  ): void {
    // FIXED M7: Enhanced command name validation
    if (!name || typeof name !== 'string') {
      throw new Error('Command name must be a non-empty string');
    }
    
    if (!VALID_COMMAND_PATTERN.test(name)) {
      throw new Error(`Invalid command name: ${name}. Must match pattern: ${VALID_COMMAND_PATTERN.source}`);
    }
    
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(name)) {
        throw new Error(`Command name contains dangerous pattern: ${name}`);
      }
    }
    
    this.commandHandlers.set(name, handler);
    this.logger.debug(`Registered command: ${name}`);
  }

  unregisterCommand(name: string): boolean {
    const existed = this.commandHandlers.has(name);
    this.commandHandlers.delete(name);
    
    if (existed) {
      this.logger.debug(`Unregistered command: ${name}`);
    }
    
    return existed;
  }

  async executeCommand(command: string, args: Record<string, unknown>): Promise<CommandResult> {
    // FIXED M7: Enhanced command name validation
    if (!command || typeof command !== 'string') {
      return {
        success: false,
        error: 'Command name must be a non-empty string'
      };
    }
    
    if (!VALID_COMMAND_PATTERN.test(command)) {
      return {
        success: false,
        error: `Invalid command name: ${command}`
      };
    }
    
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return {
          success: false,
          error: `Command name contains dangerous pattern: ${command}`
        };
      }
    }

    // Validate and sanitize arguments
    const sanitizedArgs = this.sanitizeArguments(args);

    const handler = this.commandHandlers.get(command);
    
    if (!handler) {
      return {
        success: false,
        error: `Unknown command: ${command}`
      };
    }

    try {
      return await handler(sanitizedArgs);
    } catch (error) {
      this.logger.error(`Command execution failed: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async sendCommand(peerId: string, command: string, args: Record<string, unknown>): Promise<void> {
    // FIXED M7: Enhanced command name validation before sending
    if (!command || typeof command !== 'string') {
      throw new Error('Command name must be a non-empty string');
    }
    
    if (!VALID_COMMAND_PATTERN.test(command)) {
      throw new Error(`Invalid command name: ${command}`);
    }
    
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        throw new Error(`Command name contains dangerous pattern: ${command}`);
      }
    }

    const message: SilkMessage = {
      header: {
        version: 1,
        type: MessageType.COMMAND,
        id: this.generateMessageId(),
        timestamp: Date.now(),
        sender: this.node.peerId.toString()
      },
      payload: {
        command,
        args
      }
    };

    await this.node.sendMessage(peerId, message);
  }

  private async handleMessage(message: SilkMessage, peerId: string): Promise<void> {
    // Check if peer is authorized for remote commands
    if (this.config.authorizedPeers && !this.config.authorizedPeers.includes(peerId)) {
      return;
    }

    switch (message.header.type) {
      case MessageType.COMMAND:
        await this.handleCommandMessage(message, peerId);
        break;
      
      case MessageType.TEXT:
        await this.handleTextMessage(message, peerId);
        break;
      
      default:
        // Pass through other message types
        break;
    }
  }

  private async handleCommandMessage(message: SilkMessage, peerId: string): Promise<void> {
    if (!this.config.allowRemoteCommands) {
      this.logger.debug(`Remote commands disabled, ignoring command from ${peerId}`);
      return;
    }

    const payload = message.payload as CommandPayload;
    
    // FIXED M7: Enhanced command name validation
    if (!payload.command || typeof payload.command !== 'string') {
      this.logger.warn(`Invalid command from ${peerId}: missing or invalid command name`);
      return;
    }
    
    if (!VALID_COMMAND_PATTERN.test(payload.command)) {
      this.logger.warn(`Invalid command name from ${peerId}: ${payload.command}`);
      return;
    }
    
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(payload.command)) {
        this.logger.warn(`Dangerous command pattern from ${peerId}: ${payload.command}`);
        return;
      }
    }

    this.logger.debug(`Received command from ${peerId}: ${payload.command}`);

    const result = await this.executeCommand(payload.command, payload.args);
    
    // Send response back
    await this.sendResponse(peerId, message.header.id, result);
    
    // Emit event
    this.emit('command', {
      peerId,
      command: payload.command,
      args: payload.args,
      result
    });
  }

  private async handleTextMessage(message: SilkMessage, peerId: string): Promise<void> {
    const payload = message.payload as { content: string };
    
    // Check for command prefix
    const prefix = this.config.commandPrefix ?? '/cmd';
    if (!payload.content || typeof payload.content !== 'string') {
      return;
    }
    
    if (!payload.content.startsWith(prefix)) {
      return;
    }

    const commandStr = payload.content.slice(prefix.length).trim();
    if (!commandStr) {
      return;
    }

    // Parse command and arguments safely
    const parseResult = this.parseCommandString(commandStr);
    if (!parseResult.success) {
      this.logger.debug(`Failed to parse command from ${peerId}: ${parseResult.error}`);
      return;
    }

    const { command, args } = parseResult;

    const result = await this.executeCommand(command, args);
    await this.sendResponse(peerId, message.header.id, result);
  }

  /**
   * Safely parse a command string into command name and arguments
   */
  private parseCommandString(commandStr: string): 
    | { success: true; command: string; args: Record<string, unknown> }
    | { success: false; error: string } {
    
    // Split by whitespace, respecting quotes
    const tokens = this.tokenize(commandStr);
    
    if (tokens.length === 0) {
      return { success: false, error: 'Empty command' };
    }

    const command = tokens[0]!;
    
    // FIXED M7: Enhanced command name validation
    if (!VALID_COMMAND_PATTERN.test(command)) {
      return { success: false, error: `Invalid command name: ${command}` };
    }
    
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return { success: false, error: `Dangerous command pattern: ${command}` };
      }
    }

    const args: Record<string, unknown> = {};
    
    // Parse arguments as key-value pairs
    for (let i = 1; i < tokens.length; i += 2) {
      const key = tokens[i];
      const value = tokens[i + 1];
      
      if (!key) continue;
      
      // Remove -- prefix if present
      const cleanKey = key.startsWith('--') ? key.slice(2) : key;
      
      // Validate key
      if (!VALID_COMMAND_PATTERN.test(cleanKey)) {
        this.logger.debug(`Skipping invalid argument key: ${cleanKey}`);
        continue;
      }
      
      // Check for dangerous patterns in key
      let hasDangerousPattern = false;
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(cleanKey)) {
          hasDangerousPattern = true;
          break;
        }
      }
      if (hasDangerousPattern) {
        this.logger.debug(`Skipping dangerous argument key: ${cleanKey}`);
        continue;
      }

      // Check key length
      if (cleanKey.length > MAX_ARG_KEY_LENGTH) {
        this.logger.debug(`Argument key too long: ${cleanKey}`);
        continue;
      }

      // Handle value
      if (value === undefined || value.startsWith('--')) {
        // Boolean flag
        args[cleanKey] = true;
        // Step back to process this token as a key in next iteration
        i--;
      } else {
        // Check value length
        if (value.length > MAX_ARG_VALUE_LENGTH) {
          this.logger.debug(`Argument value too long for key: ${cleanKey}`);
          args[cleanKey] = value.slice(0, MAX_ARG_VALUE_LENGTH);
        } else {
          // Try to parse as JSON, fallback to string
          args[cleanKey] = this.parseValue(value);
        }
      }
    }

    return { success: true, command, args };
  }

  /**
   * Tokenize a command string, respecting quoted strings
   */
  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (const char of input) {
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        tokens.push(current);
        current = '';
      } else if (!inQuotes && /\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Parse a string value, attempting JSON parsing for complex types
   */
  private parseValue(value: string): unknown {
    // Try JSON parsing first
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']')) ||
        value === 'true' ||
        value === 'false' ||
        value === 'null' ||
        /^-?\d+(\.\d+)?$/.test(value)) {
      try {
        return JSON.parse(value);
      } catch {
        // Fall through to string
      }
    }
    return value;
  }

  /**
   * Sanitize command arguments to prevent injection
   * FIXED L9: Added recursion depth limit
   */
  private sanitizeArguments(args: Record<string, unknown>, depth = 0): Record<string, unknown> {
    // FIXED L9: Check recursion depth
    const maxDepth = this.config.maxRecursionDepth ?? DEFAULT_MAX_RECURSION_DEPTH;
    if (depth > maxDepth) {
      this.logger.warn(`Maximum recursion depth (${maxDepth}) reached during argument sanitization`);
      return {};
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      // Validate key
      if (!VALID_COMMAND_PATTERN.test(key) || key.length > MAX_ARG_KEY_LENGTH) {
        this.logger.debug(`Skipping invalid argument key: ${key}`);
        continue;
      }
      
      // Check for dangerous patterns in key
      let hasDangerousPattern = false;
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(key)) {
          hasDangerousPattern = true;
          break;
        }
      }
      if (hasDangerousPattern) {
        this.logger.debug(`Skipping dangerous argument key: ${key}`);
        continue;
      }

      // Sanitize value based on type
      if (typeof value === 'string') {
        if (value.length > MAX_ARG_VALUE_LENGTH) {
          sanitized[key] = value.slice(0, MAX_ARG_VALUE_LENGTH);
        } else {
          sanitized[key] = value;
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value === null) {
        sanitized[key] = null;
      } else if (Array.isArray(value)) {
        // Sanitize array elements with length limit
        sanitized[key] = value.slice(0, MAX_ARRAY_LENGTH).map(v => 
          typeof v === 'string' ? v.slice(0, MAX_ARG_VALUE_LENGTH) : v
        );
      } else if (typeof value === 'object') {
        // Recursively sanitize nested objects (with depth limit)
        sanitized[key] = this.sanitizeArguments(value as Record<string, unknown>, depth + 1);
      } else {
        // Convert other types to string
        sanitized[key] = String(value).slice(0, MAX_ARG_VALUE_LENGTH);
      }
    }

    return sanitized;
  }

  private async sendResponse(peerId: string, requestId: string, result: CommandResult): Promise<void> {
    const message: SilkMessage = {
      header: {
        version: 1,
        type: MessageType.ACK,
        id: this.generateMessageId(),
        timestamp: Date.now(),
        sender: this.node.peerId.toString()
      },
      payload: {
        messageId: requestId,
        status: result.success ? 'processed' : 'failed',
        details: result.error ?? JSON.stringify(result.data)
      }
    };

    await this.node.sendMessage(peerId, message);
  }

  private registerDefaultCommands(): void {
    // Status command
    this.registerCommand('status', async () => {
      const networkInfo = await this.node.getNetworkInfo();
      return {
        success: true,
        data: {
          peerId: this.node.peerId.toString(),
          addresses: this.node.getMultiaddrs().map(a => a.toString()),
          connections: this.node.getPeers().length,
          networkInfo
        }
      };
    });

    // Peers command
    this.registerCommand('peers', async () => {
      return {
        success: true,
        data: {
          peers: this.node.getPeers()
        }
      };
    });

    // Connect command
    this.registerCommand('connect', async (args) => {
      const addr = args.address as string;
      if (!addr || typeof addr !== 'string') {
        return {
          success: false,
          error: 'Missing or invalid address argument'
        };
      }

      try {
        await this.node.dial(addr);
        return {
          success: true,
          data: { connected: addr }
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message
        };
      }
    });

    // Disconnect command
    this.registerCommand('disconnect', async (args) => {
      const peerId = args.peerId as string;
      if (!peerId || typeof peerId !== 'string') {
        return {
          success: false,
          error: 'Missing or invalid peerId argument'
        };
      }

      try {
        await this.node.hangUp(peerId);
        return {
          success: true,
          data: { disconnected: peerId }
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message
        };
      }
    });
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Check if bridge is running
   */
  getIsRunning(): boolean {
    return this.running;
  }
  
  /**
   * Get list of registered commands
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.commandHandlers.keys());
  }
  
  /**
   * Check if a command is registered
   */
  hasCommand(name: string): boolean {
    return this.commandHandlers.has(name);
  }
}
