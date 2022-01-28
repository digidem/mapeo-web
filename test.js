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
const discoveryKey = require('./discoveryKey')

const MapeoWeb = require('./')

tmp.setGracefulCleanup()

function makeMapeo (dir, encryptionKey, opts = {}) {
  const osm = osmdb({
    dir,
    encryptionKey
  })
  const media = blobstore(path.join(dir, 'media'))

  const mapeo = new Mapeo(osm, media, {
    id: crypto.randomBytes(8).toString('hex'),
    ...opts
  })

  osm.close = function (cb) {
    this.index.close(cb)
  }

  return mapeo
}

function makeWeb (storageLocation, cb, opts = {}) {
  const serverId = crypto.randomBytes(8).toString('hex')

  const mapeoWeb = MapeoWeb.create({
    // Comment this line out to get logs
    logger: pino({ level: 'silent' }),
    // logger: pino(),
    storageLocation,
    id: serverId,
    ...opts
  })

  getPort().then((port) => {
    mapeoWeb.listen(port, () => cb(null, {
      port,
      mapeoWeb,
      serverId
    }))
  }).catch(cb)
}

function writeMedia (mapeo, cb) {
  const ws = mapeo.media.createWriteStream('foo.txt')
  ws.on('finish', cb)
  ws.on('error', cb)
  ws.end('bar')
}

function writeOSM (mapeo, cb) {
  const observation = { lat: 1, lon: 2, type: 'observation' }
  mapeo.osm.create(observation, cb)
}

function verifyData ({ webPeer, osmId, tape }, cb) {
  webPeer.osm.get(osmId, (e, node) => {
    tape.error(e, 'No error getting OSM')
    tape.ok(node, 'OSM node exists')
    webPeer.media.exists('foo.txt', (err, exists) => {
      tape.error(err, 'No error reading file')
      tape.ok(exists, 'File exists')
      cb()
    })
  })
}

function getObservationCount (mapeo, cb) {
  mapeo.observationList((err, results) => {
    cb(err, results.length)
  })
}

test('Sync between a mapeo instance and a server', (t) => {
  t.plan(16)
  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32)

  const mapeo = makeMapeo(mapeoDir, projectKey)

  makeWeb(serverDir, (err, { mapeoWeb, port, serverId }) => {
    t.error(err, 'able to init mapeo-web')
    mapeo.osm.ready(() => {
      putProject(port, (e) => {
        t.error(e, 'added project')
        writeOSM(mapeo, (e, id) => {
          mapeo.sync.once('peer', (peer) => verifyPeer(peer, id, port))
          t.error(e, 'initialized OSM data')
          writeMedia(mapeo, (e) => {
            t.error(e, 'initialized media')
            replicate(port)
          })
        })
      })
    })

    function verifyPeer (peer, osmId, port) {
      t.pass('Got peer')
      const sync = mapeo.sync.replicate(peer)
      sync.on('end', () => {
        t.pass('Finished sync')
        getObservationCount(mapeo, (err, count) => {
          t.error(err, 'Retrieved observation count for client')
          t.equal(count, 1, 'Observation count for client has not changed')
        })
        verifyData({
          webPeer: mapeoWeb.get(projectKey),
          osmId,
          tape: t
        }, () => {
          listAndRemove(port, finishUp)
        })
      })
    }

    function listAndRemove (port, cb) {
      const keyString = projectKey.toString('hex')
      const url = `http://localhost:${port}`

      Client.list({ url }).then(async (keys) => {
        t.deepEqual(keys, [{ discoveryKey: discoveryKey(keyString) }], 'Project in list on server')

        await Client.remove({ url, projectKey })

        const finalKeys = await Client.list({ url })

        t.deepEqual(finalKeys, [], 'Project removed from server')

        cb(null)
      }).catch(cb)
    }

    function finishUp (err) {
      if (err) t.error(err)
      mapeo.close(() => {
        mapeoWeb.close((err) => {
          t.error(err, 'Closed with no errors')
          t.end()
        })
      })
    }

    function replicate (port) {
      const url = `ws://localhost:${port}/`
      mapeo.sync.connectWebsocket(url, projectKey)
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
  })
})

/**
 * 1. Peer 1 creates data. Syncs data to web.
 * 2. Peer 2 _does not_ create data. Attempts to sync with web.
 */
test('Sync between multiple mapeo instances and a server', (t) => {
  t.plan(26)
  const mapeoDir1 = tmp.dirSync().name
  const mapeoDir2 = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32)

  const mapeo1 = makeMapeo(mapeoDir1, projectKey)
  const mapeo2 = makeMapeo(mapeoDir2, projectKey)

  makeWeb(serverDir, (err, { mapeoWeb, port, serverId }) => {
    t.error(err, 'able to init mapeo-web')
    mapeo1.osm.ready(() => {
      putProject(port, (e) => {
        t.error(e, 'added project')
        writeOSM(mapeo1, (e, id) => {
          mapeo1.sync.once('peer', (peer) => verifyPeer1(peer, id, port))
          t.error(e, 'initialized OSM data')
          writeMedia(mapeo1, (e) => {
            t.error(e, 'initialized media')
            replicate(mapeo1, port)
          })
        })
      })
    })

    function verifyPeer1 (peer, osmId, port) {
      t.pass('Got peer')
      const sync = mapeo1.sync.replicate(peer)

      sync.on('end', () => {
        t.pass('Finished sync')
        getObservationCount(mapeo1, (err, count) => {
          t.error(err, 'Retrieved observation count for first client')
          t.equal(count, 1, 'Observation count for first client has not changed')
        })
        verifyData({ webPeer: mapeoWeb.get(projectKey), osmId, tape: t }, () => {
          syncPeer2(osmId)
        })
      })
    }

    function syncPeer2 (osmId) {
      mapeo2.osm.ready(() => {
        putProject(port, (e) => {
          t.error(e, 'added project')
          mapeo2.sync.once('peer', (peer) => verifyPeer2(peer, osmId, port))
          replicate(mapeo2, port)
        })
      })
    }

    function verifyPeer2 (peer, osmId, port) {
      t.pass('Got peer')
      const sync = mapeo2.sync.replicate(peer)
      sync.on('end', () => {
        t.pass('Finished sync')
        getObservationCount(mapeo2, (err, count) => {
          t.error(err, 'Retrieved observation count for second client')
          t.equal(count, 1, 'Observation count for second client has updated')
        })
        verifyData({ webPeer: mapeoWeb.get(projectKey), osmId, tape: t }, () => {
          listAndRemove(port, finishUp)
        })
      })
    }

    function listAndRemove (port, cb) {
      const keyString = projectKey.toString('hex')
      const url = `http://localhost:${port}`

      Client.list({ url }).then(async (keys) => {
        t.deepEqual(keys, [{ discoveryKey: discoveryKey(keyString) }], 'Project in list on server')

        await Client.remove({ url, projectKey })

        const finalKeys = await Client.list({ url })

        t.deepEqual(finalKeys, [], 'Project removed from server')

        cb(null)
      }).catch(cb)
    }

    function finishUp (err) {
      if (err) t.error(err)
      mapeo1.close(() => {
        mapeoWeb.close((err) => {
          t.error(err, 'Closed with no errors')
          t.end()
        })
      })
    }

    function replicate (mapeo, port) {
      const url = `ws://localhost:${port}/`
      mapeo.sync.connectWebsocket(url, projectKey)
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
  })
})

test('Adding invalid project key (64 non-hex characters) fails gracefully', (t) => {
  const serverDir = tmp.dirSync().name

  makeWeb(serverDir, (err, { mapeoWeb, port, serverId }) => {
    const invalidKey = 'wow, okay this is obviously fake, ha ha....'

    t.error(err, 'able to listen')
    const url = `http://localhost:${port}`

    Client.add({ url, projectKey: invalidKey }).then(() => {
      t.fail('Should not accept invalid keys')
    }).catch((err) => {
      t.ok(err, 'Got error adding invalid key')
      mapeoWeb.close((err) => {
        t.error(err, 'closed with no errors')
        t.end()
      })
    })
  })
})

test('Trying to sync with project key without permission fails', (t) => {
  t.plan(3)
  t.timeoutAfter(5000)

  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32)

  const mapeo = makeMapeo(mapeoDir, projectKey)

  makeWeb(serverDir, (err, { mapeoWeb, port, serverId }) => {
    t.error(err, 'able to init mapeo-web')

    const url = `ws://localhost:${port}/`
    const peer = mapeo.sync.connectWebsocket(url, projectKey)

    // For some reason there's no error, it just closes
    peer.connection.once('close', () => {
      t.pass('Got error in connection')
      finishUp()
    })

    function finishUp () {
      mapeo.close(() => {
        mapeoWeb.close((err) => {
          t.error(err, 'Closed with no errors')
          t.end()
        })
      })
    }
  })
})

test('Mapeo instance closes after timeout from last sync completion', (t) => {
  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32).toString('hex')

  const mapeo = makeMapeo(mapeoDir, projectKey)

  makeWeb(serverDir, (err, { mapeoWeb, port, serverId }) => {
    t.error(err, 'able to init mapeo-web')
    const addURL = `http://localhost:${port}`

    Client.add({ url: addURL, projectKey }).then(() => {
      const syncURL = `ws://localhost:${port}/`
      const peer = mapeo.sync.connectWebsocket(syncURL, projectKey)

      peer.connection.once('close', () => {
        const other = mapeoWeb.get(projectKey)

        const failTimer = setTimeout(() => {
          t.fail('Didnt close in time')
          other.removeListener('close', onClosed)
          finishUp()
        }, 3000)

        function onClosed () {
          t.pass('Instance closed within the timeout')
          clearTimeout(failTimer)
          finishUp()
        }

        other.on('close', onClosed)
      })
    }).catch((e) => {
      t.fail(e)
    })

    function finishUp () {
      mapeo.close(() => {
        mapeoWeb.close((err) => {
          t.error(err, 'Closed with no errors')
          t.end()
        })
      })
    }
  }, {
    gcTimeout: 1000
  })
})

test('Mapeo instance does not close if a new sync starts after first completes but before GC timeout', (t) => {
  const mapeoDir = tmp.dirSync().name
  const serverDir = tmp.dirSync().name

  const projectKey = crypto.randomBytes(32).toString('hex')

  const mapeo = makeMapeo(mapeoDir, projectKey)

  makeWeb(serverDir, (err, { mapeoWeb, port, serverId }) => {
    t.error(err, 'able to init mapeo-web')
    const addURL = `http://localhost:${port}`

    Client.add({ url: addURL, projectKey }).then(() => {
      const syncURL = `ws://localhost:${port}/`
      const peer = mapeo.sync.connectWebsocket(syncURL, projectKey)

      peer.connection.once('close', () => {
        const other = mapeoWeb.get(projectKey)

        const closeTimer = setTimeout(() => {
          t.pass('Didnt close during interval')
          other.removeListener('close', onClosed)
          finishUp()
        }, 1500)

        function onClosed () {
          t.fail('Timeout got reached despite reconnection')
          clearTimeout(closeTimer)
          finishUp()
        }

        other.on('close', onClosed)

        setTimeout(() => {
          mapeo.sync.connectWebsocket(syncURL, projectKey)
        }, 800)
      })
    }).catch((e) => {
      t.fail(e)
    })

    function finishUp () {
      mapeo.close(() => {
        mapeoWeb.close((err) => {
          t.error(err, 'Closed with no errors')
          t.end()
        })
      })
    }
  }, {
    gcTimeout: 1000
  })
})
