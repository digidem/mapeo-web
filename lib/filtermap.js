var path = require('path')
var mkdirp = require('mkdirp')
var crypto = require('crypto')
var hcrypto = require('hypercore-crypto')
var kappaKv = require('kappa-view-kv')
var level = require('level')
var { discoveryHash } = require('./utils')

module.exports = function makeView (pid) {
  mkdirp.sync(path.join('projects', pid, 'db'))

  var idx = level(path.join('projects', pid, 'db', 'filter-map'), {valueEncoding:'json'})

  return kappaKv(idx, function (msg, next) {
    if (!msg.value.id) return next()
    if (msg.value.type !== 'filter') return next()
    var msgId = msg.key + '@' + msg.seq
    var hash1 = crypto.createHash('sha256').update(pid + msgId, 'utf8').digest()
    var hash2 = discoveryHash(hash1)
    var op = { key: hash2, id: msgId, links: msg.value.links || [] }
    next(null, [op])
  })
}
