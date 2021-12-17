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
    this.fastify.get('/replicate/v1/:discoveryKey', { websocket: true }, async (connection, req, params) => {
      const { discoveryKey } = params

      this.permissions.getProjectKeyForDiscoveryKey(discoveryKey, (err, projectKey) => {
        if (err || !projectKey) {
          return connection.end('Invalid Key')
        }
        this.multiMapeo.replicate(connection, req, projectKey)
      })
    })

    this.fastify.post('/projects/', (req, reply) => {
      const { projectKey } = req.body
      this.permissions.addProjectKey(projectKey, (err) => {
        if (err) return reply.send(err)
        else reply.send({ added: true })
      })
    })

    this.fastify.delete('/projects/:discoveryKey', (req, reply) => {
      const { discoveryKey } = req.params
      this.getProjectKeyForDiscoveryKey(discoveryKey, (err, projectKey) => {
        if (err) {
          reply.status(404)
          reply.send(err)
          return
        }
        this.permissions.removeProjectKey(projectKey, (err) => {
          if (err) return reply.send(err)
          else reply.send({ added: true })
        })
      })
    })

    this.fastify.get('/projects/', (req, reply) => {
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
