/**
 * Task Router
 * Decides whether to execute locally or delegate to remote peer
 */

import { createTask, createResult } from '../protocol/message.js';

export class TaskRouter {
  constructor(options = {}) {
    this.node = options.node;
    this.localExecutor = options.localExecutor;
    this.pendingTasks = new Map(); // taskId -> { resolve, reject, timeout }
    this.defaultTimeout = options.defaultTimeout || 30000;
  }

  /**
   * Route a task to appropriate executor
   * @param {string} command - Command to execute
   * @param {object} options - Routing options
   * @param {string} options.target - 'local', 'remote', or 'auto'
   * @param {string} options.peerId - Specific peer to delegate to (if remote)
   * @param {number} options.timeout - Timeout in ms
   * @param {number} options.priority - Priority level
   * @returns {Promise<object>} Task result
   */
  async route(command, options = {}) {
    const target = options.target || 'auto';

    if (target === 'local') {
      return this._executeLocal(command, options.timeout);
    }

    if (target === 'remote') {
      if (!options.peerId) {
        throw new Error('Remote execution requires peerId');
      }
      return this._executeRemote(command, options.peerId, options.timeout, options.priority);
    }

    // Auto: simple load balancing - if we have peers, delegate
    if (target !== 'auto') {
      throw new Error(`Invalid target: ${target}. Use 'local', 'remote', or 'auto'`);
    }

    const peers = this.node.getPeers();
    if (peers.length > 0) {
      // Pick first available peer (simple strategy)
      const peerId = peers[0];
      console.log(`[Router] Auto-delegating to peer: ${peerId}`);
      return this._executeRemote(command, peerId, options.timeout, options.priority);
    }

    // No peers available, execute locally
    console.log(`[Router] No peers available, executing locally`);
    return this._executeLocal(command, options.timeout);
  }

  /**
   * Handle incoming task from remote peer
   * @param {object} taskMessage - Received task message
   */
  async handleIncomingTask(taskMessage) {
    const { id, from, payload } = taskMessage;
    const { command, timeout } = payload;

    console.log(`[Router] Received task ${id} from ${from}: ${command}`);

    const startTime = Date.now();
    try {
      const result = await this._executeLocal(command, timeout);
      const duration = Date.now() - startTime;

      // Send result back
      const resultMsg = createResult(
        this.node.getPeerId(),
        from,
        id,
        true,
        result.output,
        result.exitCode,
        duration
      );

      await this.node.send(from, resultMsg);
      console.log(`[Router] Task ${id} completed, result sent to ${from}`);
    } catch (err) {
      const duration = Date.now() - startTime;

      // Send error result
      const resultMsg = createResult(
        this.node.getPeerId(),
        from,
        id,
        false,
        err.message,
        -1,
        duration
      );

      await this.node.send(from, resultMsg);
      console.error(`[Router] Task ${id} failed:`, err.message);
    }
  }

  /**
   * Handle incoming result from remote peer
   * @param {object} resultMessage - Received result message
   */
  handleIncomingResult(resultMessage) {
    const { payload } = resultMessage;
    const { taskId } = payload;

    const pending = this.pendingTasks.get(taskId);
    if (!pending) {
      console.warn(`[Router] Received result for unknown task: ${taskId}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);
    this.pendingTasks.delete(taskId);

    // Resolve with result
    pending.resolve({
      success: payload.status === 'success',
      output: payload.output,
      exitCode: payload.exitCode,
      duration: payload.duration
    });
  }

  // Private methods

  async _executeLocal(command, timeout) {
    if (!this.localExecutor) {
      throw new Error('No local executor configured');
    }
    return this.localExecutor.execute(command, timeout);
  }

  async _executeRemote(command, peerId, timeout, priority) {
    const taskMsg = createTask(
      this.node.getPeerId(),
      peerId,
      command,
      timeout,
      priority
    );

    // Set up promise and timeout
    const { promise, resolve, reject } = this._createDeferred();

    const timeoutId = setTimeout(() => {
      this.pendingTasks.delete(taskMsg.id);
      reject(new Error(`Task timeout after ${timeout}ms`));
    }, timeout || this.defaultTimeout);

    this.pendingTasks.set(taskMsg.id, { resolve, reject, timeout: timeoutId });

    // Send task
    await this.node.send(peerId, taskMsg);
    console.log(`[Router] Sent task ${taskMsg.id} to ${peerId}`);

    return promise;
  }

  _createDeferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
}
