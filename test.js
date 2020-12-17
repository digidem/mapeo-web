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
  const osm = osmdb({
    dir,
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
  t.plan(13)
  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32)

  const serverId = crypto.randomBytes(8).toString('hex')

  const mapeo = makeMapeo(mapeoDir, projectKey)

  const mapeoWeb = MapeoWeb.create({
    storageLocation: serverDir,
    id: serverId
  })

  mapeo.osm.ready(() => {
    listen((e, port) => {
      t.error(e, 'able to listen')
      putProject(port, (e) => {
        t.error(e, 'added project')
        writeOSM((e, id) => {
          mapeo.sync.once('peer', (peer) => verifyPeer(peer, id))
          t.error(e, 'initialized OSM data')
          writeMedia((e) => {
            t.error(e, 'initialized media')
            replicate(port)
          })
        })
      })
    })
  })

  function verifyPeer (peer, osmId) {
    t.pass('Got peer')
    const sync = mapeo.sync.replicate(peer)
    sync.on('end', () => {
      t.pass('Finished sync')
      verifyData(osmId, finishUp)
    })
  }

  function verifyData (osmId, cb) {
    const local = mapeoWeb.get(projectKey)

    local.osm.get(osmId, (e, node) => {
      t.error(e, 'No erorr getting OSM')
      t.ok(node, 'OSM node exists')
      local.media.exists('foo.txt', (err, exists) => {
        t.error(err, 'No error reading file')
        t.ok(exists, 'File exists')
        cb()
      })
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
    mapeo.sync.connectWebsocket(url, projectKey)
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
    const putURL = `http://localhost:${port}/projects/`
    fetch(putURL, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectKey: keyString
      })
    }).then(async (res) => {
      t.ok(res.ok, 'Able to put key into mapeo-web')
      const { id } = await res.json()
      t.ok(id, 'Got discoveryKey from add')
      cb(null)
    }).catch(cb)
  }

  function listen (cb) {
    getPort().then((port) => {
      mapeoWeb.listen(port, () => cb(null, port))
    }).catch(cb)
  }
})
