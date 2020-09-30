const getPort = require('get-port')
/*
There is a very tiny chance of a race condition if another process starts using the same port number as you in between the time you get the port number and you actually start using it.

Race conditions in the same process are mitigated against by using a lightweight locking mechanism where a port will be held for a minimum of 15 seconds before being released again.
*/
const lockedPorts = new Map()

function getOpenPort (cb) {
  getPort.then((port) => {
    if (lockedPorts.get(port)) getOpenPort(null, cb)
    lockedPorts.set(port, true)
    setTimeout(() => {
      lockedPorts.set(port, false)
    }, 15 * 60 * 1000)
    cb(null, port)
  })
}


module.exports = getOpenPort
