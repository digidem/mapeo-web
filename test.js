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
  t.plan(8)
  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32)

  const serverId = crypto.randomBytes(8).toString('hex')

  const mapeo = makeMapeo(mapeoDir, projectKey)

  const mapeoWeb = MapeoWeb.create({
    storageLocation: serverDir,
    id: serverId
  })

  mapeo.sync.once('peer', verifyPeer)

  mapeo.osm.ready(() => {
    listen((e, port) => {
      t.error(e, 'able to listen')
      putProject(port, (e) => {
        t.error(e, 'added project')
        writeOSM((e) => {
          t.error(e, 'initialized OSM data')
          writeMedia((e) => {
            t.error(e, 'initialized media')
            replicate(port)
          })
        })
      })
    })
  })

  function verifyPeer (peer) {
    t.pass('Got peer')
    const sync = mapeo.sync.replicate(peer)
    sync.on('end', () => {
      t.pass('Finished sync')
      finishUp()
    })
  }

  function finishUp (err) {
    if (err) t.error(err)
    mapeoWeb.close((err) => {
      t.error(err, 'Closed with no errors')
      t.end()
    })
  }

  function replicate (port) {
    const url = `ws://localhost:${port}/`
    mapeo.sync.replicateFromWebsocket(url, projectKey)
  }

  function writeMedia (cb) {
    const ws = mapeo.media.createWriteStream('foo.txt')
    ws.on('finish', cb)
    ws.on('error', cb)
    ws.end('bar')
  }

  function writeOSM (cb) {
    const observation = { lat: 1, lon: 2, type: 'observation' }
    mapeo.osm.create(observation, cb)
  }

  function putProject (port, cb) {
    const keyString = projectKey.toString('hex')
    const putURL = `http://localhost:${port}/permissions/project/${keyString}`
    fetch(putURL, { method: 'put' }).then((res) => {
      t.ok(res.ok, 'Able to put key into mapeo-web')
      cb(null)
    }).catch(cb)
  }

  function listen (cb) {
    getPort().then((port) => {
      mapeoWeb.listen(port, () => cb(null, port))
    }).catch(cb)
  }
})
