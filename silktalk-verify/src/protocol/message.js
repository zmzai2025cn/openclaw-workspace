/**
 * SilkTalk Message Protocol v0.1
 * Minimal JSON-based protocol for OpenClaw P2P communication
 */

export const MessageType = {
  PING: 'ping',
  PONG: 'pong',
  TASK: 'task',
  RESULT: 'result',
  ERROR: 'error'
};

export const Priority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3
};

/**
 * Create a new message
 * @param {string} type - Message type
 * @param {string} from - Sender peerId
 * @param {string} to - Recipient peerId or 'broadcast'
 * @param {unknown} payload - Message payload
 * @returns {object} Message object
 */
export function createMessage(type, from, to, payload = {}) {
  if (!Object.values(MessageType).includes(type)) {
    throw new Error(`Invalid message type: ${type}`);
  }
  return {
    type,
    id: generateId(),
    from,
    to,
    payload,
    timestamp: Date.now()
  };
}

/**
 * Create a task message
 * @param {string} from - Sender peerId
 * @param {string} to - Recipient peerId
 * @param {string} command - Command to execute
 * @param {number} timeout - Timeout in ms
 * @param {number} priority - Priority level (1-3)
 * @returns {object} Task message
 */
export function createTask(from, to, command, timeout = 30000, priority = Priority.NORMAL) {
  return createMessage(MessageType.TASK, from, to, {
    command,
    timeout,
    priority
  });
}

/**
 * Create a result message
 * @param {string} from - Sender peerId
 * @param {string} to - Recipient peerId (original task sender)
 * @param {string} taskId - Original task ID
 * @param {boolean} success - Whether task succeeded
 * @param {string} output - Command output
 * @param {number} exitCode - Exit code
 * @param {number} duration - Execution duration in ms
 * @returns {object} Result message
 */
export function createResult(from, to, taskId, success, output, exitCode, duration) {
  return createMessage(MessageType.RESULT, from, to, {
    taskId,
    status: success ? 'success' : 'failure',
    output,
    exitCode,
    duration
  });
}

/**
 * Validate message format
 * @param {unknown} msg - Message to validate
 * @returns {boolean} True if valid
 */
export function validateMessage(msg) {
  if (!msg || typeof msg !== 'object') return false;
  if (!Object.values(MessageType).includes(msg.type)) return false;
  if (typeof msg.id !== 'string') return false;
  if (typeof msg.from !== 'string') return false;
  if (typeof msg.to !== 'string') return false;
  if (typeof msg.timestamp !== 'number') return false;
  return true;
}

/**
 * Encode message to Buffer
 * @param {object} msg - Message object
 * @returns {Buffer} Encoded message
 */
export function encode(msg) {
  return Buffer.from(JSON.stringify(msg));
}

/**
 * Decode Buffer to message
 * @param {Buffer} data - Raw data
 * @returns {object|null} Decoded message or null if invalid
 */
export function decode(data) {
  try {
    const msg = JSON.parse(data.toString());
    return validateMessage(msg) ? msg : null;
  } catch {
    return null;
  }
}

// Simple ID generator with counter to avoid collisions
let idCounter = 0;
function generateId() {
  return `${Date.now()}-${++idCounter}-${Math.random().toString(36).substr(2, 5)}`;
}
