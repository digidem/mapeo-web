const path = require('path')
const level = require('level')
const mkdirp = require('mkdirp')
const crypto = require('hypercore-crypto')

class Permissions {
  constructor ({ storageLocation }) {
    const dir = path.join(storageLocation, 'permissions-db')
    mkdirp.sync(dir)
    this.db = level(dir, {
      valueEncoding: 'json'
    })
  }

  hasProjectKey (key, cb) {
    this.db.get(discoveryKey(key), (err, value) => {
      cb(null, !err && !!value)
    })
  }

  hasProjectKeyForDiscoveryKey (discoveryKey, cb) {
    this.db.get(discoveryKey, (err, value) => {
      cb(null, !err && value)
    })
  }

  addProjectKey (key, cb) {
    this.db.put(discoveryKey(key), key, cb)
  }

  removeProjectKey (key, cb) {
    this.db.del(discoveryKey(key), cb)
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

function discoveryKey (projectKey) {
  if (typeof projectKey === 'string') {
    projectKey = Buffer.from(projectKey, 'hex')
  }
  if (Buffer.isBuffer(projectKey) && projectKey.length === 32) {
    return crypto.discoveryKey(projectKey).toString('hex')
  } else {
    throw new Error('projectKey must be a 32-byte Buffer, or a hex string encoding a 32-byte buffer')
  }
}

module.exports = Permissions
