const makeFastify = require('fastify')

const Permissions = require('./permissions')
const MultiMapeo = require('./multi-mapeo')

module.exports = {
  create
}

function create (opts) {
  const mapeoWeb = new MapeoWeb(opts)

  mapeoWeb.initRoutes()

  return mapeoWeb
}

class MapeoWeb {
  constructor (opts) {
    const permissions = new Permissions(opts)
    const multiMapeo = new MultiMapeo(opts)
    const fastify = makeFastify()

    this.permissions = permissions
    this.multiMapeo = multiMapeo
    this.fastify = fastify
  }

  initRoutes () {
    this.fastify.register(require('fastify-websocket'))

    // Leaving room for other major minor and patch versions.
    this.fastify.get('/replicate/v1/:key', { websocket: true }, async (connection, req, params) => {
      const { key } = params

      this.permissions.hasProjectKey(key, (err, has) => {
        if (err || !has) return connection.end('Invalid Key')

        this.multiMapeo.replicate(connection, req, key)
      })
    })

    this.fastify.put('/permissions/project/:key', (req, reply) => {
      const { key } = req.params
      this.permissions.addProjectKey(key, (err) => {
        if (err) return reply.send(err)
        else reply.send({ added: true })
      })
    })

    this.fastify.delete('/permissions/project/:key', (req, reply) => {
      const { key } = req.params
      this.permissions.removeProjectKey(key, (err) => {
        if (err) return reply.send(err)
        else reply.send({ added: true })
      })
    })

    this.fastify.get('/permissions/project/', (req, reply) => {
      this.permissions.getProjectKeys((err, keys) => {
        if (err) return reply.send(err)
        else reply.send(keys)
      })
    })
  }

  get (key) {
    return this.multiMapeo.get(key.toString('hex'))
  }

  listen (...args) {
    this.fastify.listen(...args)
  }

  address () {
    return this.fastify.server.address()
  }

  close (cb) {
    this.fastify.close(() => {
      this.multiMapeo.close(cb)
    })
  }
}
