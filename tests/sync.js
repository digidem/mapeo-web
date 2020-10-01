var net = require('net')
var Mapeo = require('@mapeo/core')
var Osm = require('osm-p2p')
var Blob = require('safe-fs-blob-store')
var path = require('path')
var mkdirp = require('mkdirp')
var needle = require('needle')
var crypto = require('crypto')

const MOCK_DATA = require('@mapeo/fixtures/observations.json').slice(0,5)

var hash = require('../lib/utils').discoveryHash

var pid = process.argv[2]
console.log(pid)
var discoveryKey = hash(pid)
var host = 'localhost'

var url = `http://${host}:5000/project/${discoveryKey}/sync`
console.log(url)
needle.get(url, function (err, resp) {
  if (err) throw err
  var port = resp.body.port
  sync(port)
})

function sync (port) {
  mkdirp.sync(path.join(__dirname, 'projects', pid))
  var dbdir = path.join(__dirname, 'projects', pid, 'db')

  var osm = Osm({ dir: dbdir, encryptionKey: pid })
  var media = Blob(path.join(__dirname, 'projects', pid, 'media'))
  var mapeo = new Mapeo(osm, media)

  mapeo.sync.setName('fake-mapeo-desktop')
  MOCK_DATA.map((observation) => {
    observation.type = 'observation'
    mapeo.observationCreate(observation, () => {
      console.log('CREATED OBSERVATION')
    })
  })

  mapeo.sync.on('peer', (peer) => {
    var opts = {}
    console.log('GOT PEER', peer)
    mapeo.sync.replicateNetwork(peer, opts)
  })

  var client = net.connect({
    host, port
  }, () => {
    var id = crypto.randomBytes(32)
    mapeo.sync.onConnection(client, {host, port, id})
  })

  client.on('error', (err) => {
    console.error(err)
  })

  client.on('close', () => {
    console.log('Disconnected from server')
  })
}
