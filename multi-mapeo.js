#!/usr/bin/env node
const path = require('path')
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const osmdb = require('osm-p2p')
const blobstore = require('safe-fs-blob-store')
const Mapeo = require('@mapeo/core')
const envPaths = require('env-paths')
const EventEmitter = require('events')

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
    name = DEFAULT_NAME
  }) {
    super()
    // TODO: Add leveldb to track
    this.storageLocation = storageLocation || DEFAULT_STORAGE
    this.gcTimeout = gcTimeout || DEFAULT_GC_DELAY
    this.id = id
    this.name = name || DEFAULT_NAME
    this.closed = false

    // track initialized mapeo instances
    this.instances = new Map()
    // Track active WS connections for mapeo instances
    this.connections = new Map()
    this.timeouts = new Map()
  }

  get (projectKey) {
    if (this.instances.has(projectKey)) return this.instances.get(projectKey)
    const key = discoveryKey(projectKey)
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

    this.instances.set(projectKey, mapeo)

    mapeo.sync.setName(this.name)

    mapeo.sync.listen(() => {
      mapeo.sync.join(Buffer.from(projectKey, 'hex'))
    })

    mapeo.sync.on('peer', (peer) => {
    // TODO: Should we track / report sync progress somewhere?
      mapeo.sync.replicate(peer, { deviceType: DEVICE_TYPE })
    })

    return mapeo
  }

  unget (projectKey, cb) {
    if (!this.instances.has(projectKey)) return process.nextTick(cb)
    // TODO: Close mapeo instance
    this.instances.get(projectKey).close((err) => {
      this.instances.delete(projectKey)
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
  }

  trackConnection (connection, projectKey) {
    if (!this.connections.has(projectKey)) {
      this.connections.put(projectKey, new Set())
    }

    const connections = this.connections.get(projectKey)

    connections.add(connection)

    connection.once('close', () => {
      connections.delete(connection)

      clearTimeout(this.timeouts.get(projectKey))

      const timer = setTimeout(() => {
        // New connections have been made since the last time
        if (connections.size()) return
        this.unget(projectKey, (e) => {
          if (e) console.error(e)
        })
      }, this.gcTimeout)

      this.timeouts.put(projectKey, timer)
    })
  }

  close (cb) {
    if(this.closed) return process.nextTick(cb)
    this.closed = true
    const total = this.instances.size
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
