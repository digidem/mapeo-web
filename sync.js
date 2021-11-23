var Mapeo = require('@mapeo/core')
var net = require('net')
var Osm = require('osm-p2p')
var Blob = require('safe-fs-blob-store')
var path = require('path')
var mkdirp = require('mkdirp')
var crypto = require('crypto')

var pid = process.argv[2]
var port = process.argv[3]

console.log('[STARTING]', pid, port)
mkdirp.sync(path.join(__dirname, 'projects', pid))
var dbdir = path.join(__dirname, 'projects', pid, 'db')

var osm = Osm({ dir: dbdir, encryptionKey: pid })
var media = Blob(path.join(__dirname, 'projects', pid, 'media'))
var mapeo = new Mapeo(osm, media)

// TODO: some way for the operator to provide this
mapeo.sync.setName('mapeo-web')

mapeo.sync.on('peer', (peer) => {
  mapeo.sync.replicateNetwork(peer)
})

var server = net.createServer((socket) => {
  var id = crypto.randomBytes(32)
  mapeo.sync.onConnection(socket, {
    host: socket.localAddress,
    port: socket.localPort,
    id
  })
})

server.listen(port, () => {
  process.send('message')
})
