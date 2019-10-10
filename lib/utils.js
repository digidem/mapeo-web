var hcrypto = require('hypercore-crypto')

// key is String or Buffer
function discoveryHash (key) {
  if (typeof key === 'string') {
    key = Buffer.from(key, 'hex')
  }
  if (Buffer.isBuffer(key) && key.length === 32) {
    return hcrypto.discoveryKey(key).toString('hex')
  } else {
    throw new Error('hash input must be a 32-byte buffer')
  }
}

module.exports = {
  discoveryHash
}
