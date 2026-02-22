const Libp2p = require('libp2p');
const TCP = require('@libp2p/tcp');
const MDNS = require('@libp2p/mdns');
const Bootstrap = require('@libp2p/bootstrap');
const Noise = require('@libp2p/noise');
const Mplex = require('@libp2p/mplex');

async function main() {
  console.log('Starting SilkTalk Pro node...');
  
  try {
    const node = await Libp2p.create({
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/10001']
      },
      transports: [new TCP()],
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
      peerDiscovery: [
        new MDNS(),
        new Bootstrap({
          list: []
        })
      ]
    });

    await node.start();
    
    console.log('✅ Node started successfully!');
    console.log('PeerId:', node.peerId.toB58String());
    console.log('Listen addresses:');
    node.multiaddrs.forEach((ma) => {
      console.log('  ', ma.toString() + '/p2p/' + node.peerId.toB58String());
    });
    
    // Keep running
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Failed to start node:', error.message);
    process.exit(1);
  }
}

main();
