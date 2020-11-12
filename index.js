#!/usr/bin/env node
const path = require('path')
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const osmdb = require('osm-p2p')
const blobstore = require('safe-fs-blob-store')
const makeFastify = require('fastify')
const Mapeo = require('@mapeo/core')
const envPaths = require('env-paths')

const DEFAULT_STORAGE = envPaths('mapeo-web').data
// If a mapeo instance hasn't been accessed for a minute, we should clear it out
const DEFULT_GC_DELAY = 60 * 1000

module.exports = {
  createServer
}

function createServer (opts) {
  const multiMapeo = new MultiMapeo(opts)

  const fastify = makeFastify()

  fastify.register(require('fastify-websocket'))

  // Leaving room for other major minor and patch versions.
  fastify.get('/replicate/1/:minor/:patch/:key', { websocket: true }, async (connection, req, params) => {
    const { key } = params
    // TODO: Check whether the key is allowed
    multiMapeo.replicate(connection, req, key)
  })

  fastify.multiMapeo = multiMapeo

  function listen (...args) {
    fastify.listen(...args)
  }

  function close (cb) {
    fastify.close(() => {
      multiMapeo.close(cb)
    })
  }

  return {
    multiMapeo,
    fastify,
    close,
    listen
  }
}

class MultiMapeo {
  constructor ({
    storageLocation = DEFAULT_STORAGE,
    gcTimeout = DEFULT_GC_DELAY,
    id = crypto.randombytes(8).toString('hex')
  }) {
    // TODO: Add leveldb to track
    this.storageLocation = storageLocation
    this.gcTimeout = gcTimeout
    this.id = id

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

    const osm = osmdb(dir, {
      encryptionKey: Buffer.from(key, 'hex')
    })
    const media = blobstore(path.join(dir, 'media'))

    const mapeo = new Mapeo(osm, media, { id })

    osm.close = function (cb) {
      this.index.close(cb)
    }

    this.instances.set(key, mapeo)

    mapeo.sync.listen(() => {
      mapeo.sync.join(Buffer.from(key, 'hex'))
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
    const ip = connection.socket._socket.remoteAddress

    const info = {
      id: ip,
      name: ip,
      host: ip,
      port: 80,
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
