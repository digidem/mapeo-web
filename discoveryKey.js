const crypto = require('hypercore-crypto')

module.exports = discoveryKey

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
