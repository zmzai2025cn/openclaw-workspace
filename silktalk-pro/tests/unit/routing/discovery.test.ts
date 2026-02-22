/**
 * Unit tests for PeerDiscovery
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PeerDiscovery } from '../../../src/routing/discovery.js';
import { Logger } from '../../../src/core/logger.js';

describe('PeerDiscovery', () => {
  let discovery: PeerDiscovery;

  beforeEach(() => {
    const logger = new Logger({ level: 'error' });
    discovery = new PeerDiscovery(logger, {
      mdns: true,
      dht: true,
      bootstrap: []
    });
  });

  it('should add a peer', () => {
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-1',
      addresses: ['/ip4/127.0.0.1/tcp/4001']
    });
    
    expect(discovery.hasPeer('peer-1')).toBe(true);
    expect(discovery.getPeerCount()).toBe(1);
  });

  it('should merge addresses for existing peer', () => {
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-1',
      addresses: ['/ip4/127.0.0.1/tcp/4001']
    });
    
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-1',
      addresses: ['/ip4/127.0.0.1/tcp/4002']
    });
    
    const peer = discovery.getPeer('peer-1');
    expect(peer?.addresses).toContain('/ip4/127.0.0.1/tcp/4001');
    expect(peer?.addresses).toContain('/ip4/127.0.0.1/tcp/4002');
  });

  it('should remove a peer', () => {
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-1',
      addresses: ['/ip4/127.0.0.1/tcp/4001']
    });
    
    const removed = discovery.removePeer('peer-1');
    expect(removed).toBe(true);
    expect(discovery.hasPeer('peer-1')).toBe(false);
  });

  it('should get all peers', () => {
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-1',
      addresses: ['/ip4/127.0.0.1/tcp/4001']
    });
    
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-2',
      addresses: ['/ip4/127.0.0.1/tcp/4002']
    });
    
    const peers = discovery.getPeers();
    expect(peers.length).toBe(2);
  });

  it('should find peers by protocol', () => {
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-1',
      addresses: ['/ip4/127.0.0.1/tcp/4001'],
      protocols: ['/silktalk/1.0.0']
    });
    
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-2',
      addresses: ['/ip4/127.0.0.1/tcp/4002'],
      protocols: ['/other/1.0.0']
    });
    
    const silktalkPeers = discovery.findPeersByProtocol('/silktalk/1.0.0');
    expect(silktalkPeers.length).toBe(1);
    expect(silktalkPeers[0].peerId).toBe('peer-1');
  });

  it('should clear all peers', () => {
    discovery.addPeer({
      type: 'peer',
      peerId: 'peer-1',
      addresses: ['/ip4/127.0.0.1/tcp/4001']
    });
    
    discovery.clear();
    expect(discovery.getPeerCount()).toBe(0);
  });
});
