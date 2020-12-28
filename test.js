const test = require('tape')
const tmp = require('tmp')
const path = require('path')
const Mapeo = require('@mapeo/core')
const crypto = require('crypto')
const getPort = require('get-port')
const osmdb = require('osm-p2p')
const blobstore = require('safe-fs-blob-store')
const Client = require('./client')
const pino = require('pino')

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
  t.plan(14)
  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32)

  const serverId = crypto.randomBytes(8).toString('hex')

  const mapeo = makeMapeo(mapeoDir, projectKey)

  const mapeoWeb = MapeoWeb.create({
    // Comment this line out to get logs
    logger: pino({ level: 'silent' }),
    // logger: pino(),
    storageLocation: serverDir,
    id: serverId
  })

  mapeo.osm.ready(() => {
    listen((e, port) => {
      t.error(e, 'able to listen')
      putProject(port, (e) => {
        t.error(e, 'added project')
        writeOSM((e, id) => {
          mapeo.sync.once('peer', (peer) => verifyPeer(peer, id, port))
          t.error(e, 'initialized OSM data')
          writeMedia((e) => {
            t.error(e, 'initialized media')
            replicate(port)
          })
        })
      })
    })
  })

  function verifyPeer (peer, osmId, port) {
    t.pass('Got peer')
    const sync = mapeo.sync.replicate(peer)
    sync.on('end', () => {
      t.pass('Finished sync')
      verifyData(osmId, () => {
        listAndRemove(port, finishUp)
      })
    })
  }

  function listAndRemove (port, cb) {
    const keyString = projectKey.toString('hex')
    const url = `http://localhost:${port}`

    Client.list({ url }).then(async (keys) => {
      t.deepEqual(keys, [{ projectKey: keyString }], 'Project in list on server')

      await Client.remove({ url, projectKey })

      const finalKeys = await Client.list({ url })

      t.deepEqual(finalKeys, [], 'Project removed from server')

      cb(null)
    }).catch(cb)
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
    const url = `http://localhost:${port}`

    Client.add({ url, projectKey: keyString }).then(async (res) => {
      const { id } = res
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
