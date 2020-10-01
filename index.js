#!/usr/bin/env node

const fs = require('fs')
const http = require('http')
const url = require('url')
const querystring = require('querystring')
const routes = require('routes')
const path = require('path')
const mkdirp = require('mkdirp')
const { fork } = require('child_process')
const getOpenPort = require('./lib/get-open-port.js')

var helpers = require('./lib/utils')

// projectId => mapeo-core instance
const discoveryKeys = new Map()
const projects = new Map()

var utils = {
  getProject,
  getProjectId,
  loadProject,
  removeProject,
  hash: helpers.discoveryHash
}

loadDiscoveryKeys(function (err) {
  if (err) throw err
  startServer()
})

function startServer () {
  var router = routes()
  router.addRoute('GET /', require('./routes/main'))
  router.addRoute('GET /project/:discovery_key', require('./routes/project'))
  router.addRoute('GET /project/:discovery_key/sync', require('./routes/discovery'))

  http.createServer(function (req, res) {
    var parsed = url.parse(req.url)
    var q = querystring.parse(parsed.query)
    var str = req.method + ' ' + parsed.pathname
    var m = router.match(str)
    if (m) {
      m.fn.apply(null, [req, res, q, m.params, m.splats, utils])
    } else {
      res.statusCode = 404
      res.end('no such route')
    }
  })
    .listen(5000, function () {
      var address = this.address().address
      if (address === '::') address = '0.0.0.0'
      console.log(`Listening on http://${address}:${this.address().port}`)
    })
}

function loadDiscoveryKeys (cb) {
  mkdirp.sync('projects')
  fs.readdir('projects', function (err, files) {
    if (err) return cb(err)
    var pending = 1
    files.forEach(function (pid) {
      if (!/^[A-Fa-f0-9]{64}$/.test(pid)) return
      ++pending
      var ok = '[ OK ]'
      var hash1 = utils.hash(pid)
      discoveryKeys.set(hash1, pid)
      var padding = new Array(process.stdout.columns || 80 - pid.length - ok.length).fill(' ').join('')
      console.log(hash1, padding, ok)
      if (!--pending) cb()
    })
    if (!--pending) cb()
  })
}

function loadProject (pid, cb) {
  if (projects.get(pid)) return cb(null, projects.get(pid))
  getOpenPort((err, port) => {
    if (err) return cb(err)
    const modulePath = path.join(__dirname, 'sync.js')
    var subprocess = fork(modulePath, [pid, port])
    subprocess.once('close', function () {
      if (projects.get(pid)) projects.delete(pid)
      cb(new Error('failed'))
    })
    subprocess.on('error', function (err) {
      console.error(err)
      if (projects.get(pid)) projects.delete(pid)
      cb(err)
    })
    // THis is a
    subprocess.on('message', function () {
      const project = {
        subprocess, port
      }
      projects.set(pid, project)
      cb(null, project)
    })
  })
}

// Loads a project + starts swarming
function getProjectId (pid) {
  return discoveryKeys.get(pid)
}

function getProject (pid) {
  return projects.get(pid)
}

function removeProject (pid, cb) {
  const project = projects.get(pid)
  project.subprocess.once('close', (code, signal) => {
    done()
  })
  const killed = project.subprocess.kill()
  if (killed) console.log('process killed')
  else console.log('failed to kill process')

  function done () {
    fs.rename(path.join('projects', pid), path.join('projects', 'dead-' + String(Math.random()).slice(2)), cb)
    discoveryKeys.delete(pid)
  }
}
