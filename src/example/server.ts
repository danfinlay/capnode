import { Stream } from "stream";
var Capnode = require('../../index').default;

var net = require('net');

console.log('creating server')
var server = net.createServer(function (serverStream: Stream) {
    console.log('server created, creating capnode for serving')
    var capnode = new Capnode({
        index: {
            transform : function (s:string) {
                return s.replace(/[aeiou]{2,}/, 'oo').toUpperCase()
            }
        }
    });
    const remote = capnode.createRemote();
    console.log('capnode initialized')
    serverStream.pipe(remote).pipe(serverStream);
});

console.log('server listening...')
server.listen(5004);
console.log('server listening on port 5004');
