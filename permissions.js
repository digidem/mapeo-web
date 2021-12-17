const path = require('path')
const level = require('level')
const mkdirp = require('mkdirp')
const discoveryKey = require('./discoveryKey')

class Permissions {
  constructor ({ storageLocation }) {
    const dir = path.join(storageLocation, 'permissions-db')
    mkdirp.sync(dir)
    this.db = level(dir, {
      valueEncoding: 'json'
    })
  }

  getProjectKeyForDiscoveryKey (discoveryKey, cb) {
    this.db.get(discoveryKey, cb)
  }

  addProjectKey (projectKey, cb) {
    this.db.put(discoveryKey(projectKey), projectKey, cb)
  }

  removeProjectKey (projectKey, cb) {
    this.db.del(discoveryKey(projectKey), cb)
  }

  getProjectKeys (cb) {
    const keys = []
    const iterator = this.db.iterator()

    iterator.next(kick)
    function kick (err, key, value) {
      if (err) return cb(err)
      if (!key && !value) return cb(null, keys)
      keys.push(value)
      iterator.next(kick)
    }
  }
}

module.exports = Permissions
