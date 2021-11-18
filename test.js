const test = require('tape')
const tmp = require('tmp')
const path = require('path')
const Mapeo = require('@mapeo/core')
const crypto = require('crypto')
const getPort = require('get-port')
const osmdb = require('osm-p2p')
const blobstore = require('safe-fs-blob-store')
const fetch = require('cross-fetch')

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
  t.plan(3)
  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32)

  const serverId = crypto.randomBytes(8).toString('hex')

  const mapeo = makeMapeo(mapeoDir, projectKey)

  const mapeoWeb = MapeoWeb.create({
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
        const keyString = projectKey.toString('hex')
        const putURL = `http://localhost:${port}/permissions/project/${keyString}`

        fetch(putURL, { method: 'put' }).then((res) => {
          t.ok(res.ok, 'Able to put key into mapeo-web')
          mapeo.sync.replicateFromWebsocket(url, projectKey)
        }).catch((e) => {
          t.error(e)
        })
      })
    })
  })
})
