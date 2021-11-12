const test = require('tape')
const tmp = require('tmp')
const path = require('path')
const Mapeo = require('@mapeo/core')
const crypto = require('crypto')
const getPort = require('get-port')
const osmdb = require('osm-p2p')
const blobstore = require('safe-fs-blob-store')

const MapeoWeb = require('./')

tmp.setGracefulCleanup()

function makeMapeo (dir, encryptionKey) {
  const osm = osmdb(dir, {
    encryptionKey
  })
  const media = blobstore(path.join(dir, 'media'))

  const mapeo = new Mapeo(osm, media, {
    id: crypto.randomBytes(8).toString('hex')
  })

  osm.close = function (cb) {
    this.index.close(cb)
  }

  return mapeo
}

test('Sync between a mapeo instance and a server', (t) => {
  t.plan(2)
  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32)

  const serverId = crypto.randomBytes(8).toString('hex')

  const mapeo = makeMapeo(mapeoDir, projectKey)

  const mapeoWeb = MapeoWeb.createServer({
    storageLocation: serverDir,
    id: serverId
  })

  mapeo.sync.once('peer', (peer) => {
    t.pass('Got peer')
    mapeoWeb.close((err) => {
      t.error(err, 'Closed with no errors')
      t.end()
    })
  })

  mapeo.osm.ready(() => {
    getPort().then((port) => {
      mapeoWeb.listen(port, () => {
        const url = `ws://localhost:${port}/`
        mapeo.sync.replicateFromWebsocket(url, projectKey)
      })
    })
  })
})
