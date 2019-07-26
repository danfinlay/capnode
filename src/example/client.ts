var Capnode = require('../../index').default;
var net = require('net');

console.log('creating capnode client')
const capnode = new Capnode({});
const remote = capnode.createRemote();

console.log('initializing clinet stream connection');
var remoteStream = net.connect(5004);
remoteStream.pipe(remote).pipe(remoteStream);

async function connect() {
    const index = await capnode.requestIndex(remote);
    const transformed = await index.transform('beep');
    console.log('beep => ' + transformed);
}

connect()
.then(console.log)
.catch(console.error)
