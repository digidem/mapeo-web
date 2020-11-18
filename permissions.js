const path = require('path')
const level = require('level')
const mkdirp = require('mkdirp')

class Permissions {
  constructor ({ storageLocation }) {
    const dir = path.join(storageLocation, 'permissions-db')
    mkdirp.sync(dir)
    this.db = level(dir, {
      valueEncoding: 'json'
    })
  }

  hasProjectKey (key, cb) {
    this.db.get(key, (err, value) => {
      cb(null, !err && value)
    })
  }

  addProjectKey (key, cb) {
    this.db.put(key, key, cb)
  }

  removeProjectKey (key, cb) {
    this.db.del(key, cb)
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
