var Mapeo = require('@mapeo/core')
var net = require('net')
var Osm = require('osm-p2p')
var Blob = require('safe-fs-blob-store')
var path = require('path')
var mkdirp = require('mkdirp')

var pid = process.argv._[0]
var port = process.argv._[1]

mkdirp.sync(path.join('projects', pid))
var dbdir = path.join('projects', pid, 'db')

var osm = Osm({ dir: dbdir, encryptionKey: pid })
var media = Blob(path.join('projects', pid, 'media'))
var mapeo = new Mapeo(osm, media)

// TODO: some way for the operator to provide this
mapeo.sync.setName('mapeo-web')

mapeo.on('peer', (peer) => {
  mapeo.syncNetwork(peer)
})

var server = net.createServer((c) => {
  mapeo.sync.onConnection(c, {
  })
})

server.listen(port, () => {
  process.send('ready')
})

