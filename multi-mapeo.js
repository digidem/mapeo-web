#!/usr/bin/env node
const path = require('path')
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const osmdb = require('osm-p2p')
const blobstore = require('safe-fs-blob-store')
const Mapeo = require('@mapeo/core')
const envPaths = require('env-paths')
const EventEmitter = require('events')
const pino = require('pino')

const discoveryKey = require('./discoveryKey')

const DEFAULT_STORAGE = envPaths('mapeo-web').data
// If a mapeo instance hasn't been accessed for a minute, we should clear it out
const DEFAULT_GC_DELAY = 60 * 1000
const HOSTNAME = require('os').hostname()
const DEFAULT_NAME = 'Mapeo Web ' + HOSTNAME
const DEVICE_TYPE = 'cloud'

module.exports = class MultiMapeo extends EventEmitter {
  constructor ({
    storageLocation = DEFAULT_STORAGE,
    gcTimeout = DEFAULT_GC_DELAY,
    id = crypto.randomBytes(8).toString('hex'),
    name = DEFAULT_NAME,
    logger = pino()
  }) {
    super()
    // TODO: Add leveldb to track
    this.storageLocation = storageLocation || DEFAULT_STORAGE
    this.gcTimeout = gcTimeout || DEFAULT_GC_DELAY
    this.id = id
    this.name = name || DEFAULT_NAME
    this.logger = logger.child({ source: 'multi-mapeo' })
    this.closed = false

    // track initialized mapeo instances
    // Maps discoveryKey to instance
    this.instances = new Map()
    // Track active WS connections for mapeo instances
    // Maps discoveryKey to Set of streams
    this.connections = new Map()
    // Maps discoveryKey to setTimeout id
    this.timeouts = new Map()
  }

  get (projectKey) {
    const key = discoveryKey(projectKey)
    if (this.instances.has(key)) return this.instances.get(key)

    this.logger.info({ discoveryKey: key }, 'Initializing project')

    const { storageLocation, id } = this
    const dir = path.join(storageLocation, 'instances', key)

    mkdirp.sync(dir)

    const osm = osmdb({
      dir,
      encryptionKey: Buffer.from(projectKey, 'hex')
    })
    const media = blobstore(path.join(dir, 'media'))

    const mapeo = new Mapeo(osm, media, { id, deviceType: DEVICE_TYPE })

    osm.close = function (cb) {
      this.index.close(cb)
    }

    this.instances.set(key, mapeo)

    mapeo.sync.setName(this.name)

    mapeo.sync.listen(() => {
      mapeo.sync.join(Buffer.from(projectKey, 'hex'))
    })

    mapeo.sync.on('peer', (peer) => {
      const { id, host, port, type } = peer
      this.logger.info({ peer: { id, host, port, type } }, 'Replicating with peer')
      // TODO: Should we track / report sync progress somewhere?
      mapeo.sync.replicate(peer, { deviceType: DEVICE_TYPE })
    })

    return mapeo
  }

  unget (discoveryKey, cb) {
    if (!this.instances.has(discoveryKey)) return process.nextTick(cb)
    // TODO: Close mapeo instance
    this.instances.get(discoveryKey).close((err) => {
      this.instances.delete(discoveryKey)
      if (err) return cb(err)
    })
  }

  replicate (connection, req, projectKey) {
    const mapeo = this.get(projectKey)

    // This is really gross but I don't think there are any good alternatives
    const {
      remoteAddress: host,
      remotePort: port
    } = connection.socket._socket

    const info = {
      id: host + port,
      host,
      port,
      type: 'ws'
    }

    // TODO: Add cleaner method for this
    mapeo.sync.state.addWebsocketPeer(connection, info)
    mapeo.sync.addPeer(connection, info)

    this.trackConnection(connection, discoveryKey(projectKey))
  }

  trackConnection (connection, discoveryKey) {
    if (!this.connections.has(discoveryKey)) {
      this.connections.set(discoveryKey, new Set())
    }

    const connections = this.connections.get(discoveryKey)

    connections.add(connection)

    connection.once('close', () => {
      connections.delete(connection)

      clearTimeout(this.timeouts.get(discoveryKey))

      this.logger.info({ discoveryKey }, 'Starting timeout for gc')
      const timer = setTimeout(() => {
        // New connections have been made since the last time
        if (connections.size) {
          this.logger.info({ discoveryKey }, 'Aborting gc, has connections')
          return
        }
        this.logger.info({ discoveryKey }, 'Performing gc')
        this.unget(discoveryKey, (e) => {
          if (e) console.error(e)
        })
      }, this.gcTimeout)

      this.timeouts.set(discoveryKey, timer)
    })
  }

  close (cb) {
    if (this.closed) return process.nextTick(cb)
    this.logger.info('Closing')
    this.closed = true
    const total = this.instances.size

    if (!total) return process.nextTick(cb)

    let count = 0
    let lastError = null
    for (const mapeo of this.instances.values()) {
      mapeo.close((err) => {
        count++
        if (err) lastError = err
        if (count === total) cb(lastError)
      })
    }
  }
}
