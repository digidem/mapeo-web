const makeFastify = require('fastify')
const pino = require('pino')

const Permissions = require('./permissions')
const MultiMapeo = require('./multi-mapeo')
const discoveryKey = require('./discoveryKey')

const PINO_OPTS = {
  name: 'mapeo-web'
}

module.exports = {
  create
}

function create (opts) {
  const mapeoWeb = new MapeoWeb(opts)

  mapeoWeb.initRoutes()

  return mapeoWeb
}

class MapeoWeb {
  constructor ({ logger = pino(PINO_OPTS), ...opts } = {}) {
    const permissions = new Permissions({ ...opts, logger })
    const multiMapeo = new MultiMapeo({ ...opts, logger })
    const fastify = makeFastify({ logger })

    this.logger = logger
    this.permissions = permissions
    this.multiMapeo = multiMapeo
    this.fastify = fastify
  }

  initRoutes () {
    this.fastify.register(require('fastify-websocket'))

    // Leaving room for other major minor and patch versions.
    this.fastify.get('/replicate/v1/:discoveryKey', { websocket: true }, (connection, req, params) => {
      const { discoveryKey } = params

      this.permissions.getProjectKeyForDiscoveryKey(discoveryKey, (err, projectKey) => {
        if (err || !projectKey) {
          this.logger.error({ discoveryKey }, 'Invalid project key')
          return connection.end('Invalid Key')
        }
        this.multiMapeo.replicate(connection, req, projectKey)
      })
    })

    this.fastify.post('/projects/', {
      schema: {
        body: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              minLength: 64,
              maxLength: 64
            }
          }
        }
      },
      handler: (req, reply) => {
        const { projectKey } = req.body
        this.permissions.addProjectKey(projectKey, (err) => {
          if (err) return reply.send(err)
          else {
            reply.send({
              added: true,
              id: discoveryKey(projectKey)
            })
          }
        })
      }
    })

    this.fastify.delete('/projects/:discoveryKey', (req, reply) => {
      const { discoveryKey } = req.params
      this.permissions.getProjectKeyForDiscoveryKey(discoveryKey, (err, projectKey) => {
        if (err) {
          reply.status(404)
          reply.send(err)
          return
        }
        this.permissions.removeProjectKey(projectKey, (err) => {
          if (err) return reply.send(err)
          else reply.send({ deleted: true })
        })
      })
    })

    this.fastify.get('/projects/', (req, reply) => {
      this.permissions.getProjectKeys((err, keys) => {
        if (err) {
          return reply.send(err)
        } else {
          const data = keys.map((projectKey) => ({ discoveryKey: discoveryKey(projectKey) }))
          reply.send(data)
        }
      })
    })
  }

  get (key) {
    return this.multiMapeo.get(key.toString('hex'))
  }

  listen (...args) {
    return this.fastify.listen(...args)
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
