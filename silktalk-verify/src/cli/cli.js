/**
 * Command Line Interface - Minimal version
 */

import readline from 'readline';
import { createMessage, MessageType } from '../protocol/message.js';

const COMMANDS = {
  help: 'Show help',
  peers: 'List connected peers',
  ping: 'ping <peerId> - Send ping',
  exec: 'exec <cmd> - Execute locally',
  delegate: 'delegate <peer> <cmd> - Execute remotely',
  status: 'Show node status',
  quit: 'Exit'
};

export class SilkCLI {
  constructor(options = {}) {
    this.node = options.node;
    this.router = options.router;
    this.rl = null;
    this.onClose = options.onClose || (() => process.exit(0));
  }

  start() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'silktalk> '
    });

    console.log('🕸️ SilkTalk Verification Shell\n');
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      await this._handle(line.trim());
      this.rl.prompt();
    });

    this.rl.on('close', this.onClose);
  }

  async _handle(line) {
    const [cmd, ...args] = line.split(' ');
    switch (cmd) {
      case 'help':
        Object.entries(COMMANDS).forEach(([k, v]) => console.log(`${k}: ${v}`));
        break;
      case 'peers':
        this.node.getPeers().forEach((p, i) => console.log(`${i + 1}. ${p}`));
        break;
      case 'ping':
        if (args[0]) {
          await this._ping(args[0]);
        } else {
          console.log('Usage: ping <peerId>');
        }
        break;
      case 'exec':
        if (args.length) {
          console.log(await this.router.route(args.join(' '), { target: 'local' }));
        } else {
          console.log('Usage: exec <command>');
        }
        break;
      case 'delegate':
        if (args.length > 1) {
          console.log(await this.router.route(args.slice(1).join(' '), { target: 'remote', peerId: args[0] }));
        } else {
          console.log('Usage: delegate <peerId> <command>');
        }
        break;
      case 'status':
        console.log(`Name: ${this.node.name}, Peers: ${this.node.getPeers().length}`);
        break;
      case 'quit':
        this.rl.close();
        break;
      default:
        if (cmd) console.log(`Unknown command: ${cmd}. Type 'help' for available commands.`);
    }
  }

  async _ping(peerId) {
    await this.node.send(peerId, createMessage(MessageType.PING, this.node.getPeerId(), peerId, { ts: Date.now() }));
    console.log('Ping sent');
  }
}
