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
    id = crypto.randombytes(8).toString('hex')
  }) {
    // TODO: Add leveldb to track
    this.storageLocation = storageLocation
    this.instances = new Map()
    this.id = id
  }

  get (key) {
    if (this.instances.has(key)) return this.instances.get(key)
    const { storageLocation, id } = this
    const dir = path.join(storageLocation, 'instances', key)
    mkdirp.sync(dir)

    const osm = osmdb(dir)
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

    mapeo.sync.state.addWebsocketPeer(connection, info)

    mapeo.sync.addPeer(connection, info)
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
