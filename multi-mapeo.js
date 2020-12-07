#!/usr/bin/env node
const path = require('path')
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const osmdb = require('osm-p2p')
const blobstore = require('safe-fs-blob-store')
const Mapeo = require('@mapeo/core')
const envPaths = require('env-paths')
const EventEmitter = require('events')

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

    // track initialized mapeo instances
    this.instances = new Map()
    // Track active WS connections for mapeo instances
    this.connections = new Map()
  }

  get (key) {
    if (this.instances.has(key)) return this.instances.get(key)
    const { storageLocation, id } = this
    const dir = path.join(storageLocation, 'instances', key)
    mkdirp.sync(dir)

    const osm = osmdb({
      dir,
      encryptionKey: Buffer.from(key, 'hex')
    })
    const media = blobstore(path.join(dir, 'media'))

    const mapeo = new Mapeo(osm, media, { id, deviceType: DEVICE_TYPE })

    osm.close = function (cb) {
      this.index.close(cb)
    }

    this.instances.set(key, mapeo)

    mapeo.sync.setName(this.name)

    mapeo.sync.listen(() => {
      mapeo.sync.join(Buffer.from(key, 'hex'))
    })

    mapeo.sync.on('peer', (peer) => {
    // TODO: Should we track / report sync progress somewhere?
      mapeo.sync.replicate(peer, {deviceType: DEVICE_TYPE })
    })

    return mapeo
  }

  unget (key, cb) {
    if (!this.instances.has(key)) return process.nextTick(cb)
    // TODO: Close mapeo instance
    this.instances.get(key).close((err) => {
      this.instances.delete(key)
      if (err) return cb(err)
    })
  }

  replicate (connection, req, key) {
    const mapeo = this.get(key)

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

  trackConnection (connection, key) {
    if (!this.connections.has(key)) {
      this.connections.put(key, new Set())
    }

    const connections = this.connections.get(key)

    connections.add(connection)

    connection.once('close', () => {
      connections.delete(connection)
      setTimeout(() => {
        // New connections have been made since the last time
        if (connections.size()) return
        this.unget(key, (e) => {
          if (e) console.error(e)
        })
      }, this.gcTimeout)
    })
  }

  close (cb) {
    const total = [...this.instances].length
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
