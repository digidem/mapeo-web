var fs = require('fs')
var http = require('http')
var url = require('url')
var querystring = require('querystring')
var routes = require('routes')
var path = require('path')
var mkdirp = require('mkdirp')
var Mapeo = require('@mapeo/core')
var Osm = require('osm-p2p')
var Blob = require('safe-fs-blob-store')
var crypto = require('hypercore-crypto')

// projectId => mapeo-core instance
var projectCores = {}

// Protected Project ID => mapeo-core instance (hash of the project_id)
var ppidToCore = {}

var utils = {
  getOrCreateProject: loadProject,
  getProject,
  getProjectIdFromPpid,
  removeProject,
  hash
}

console.log('Loading projects..')
loadProjects(function (err) {
  if (err) throw err
  console.log('done!')
  console.log('Starting server..')
  startServer()
})

function startServer () {
  var router = routes()
  router.addRoute('GET /', require('./routes/main'))
  router.addRoute('GET /project/:project_id', require('./routes/project_overview'))
  router.addRoute('GET /project/:project_id/filters/:filter_id/export.geojson', require('./routes/project_export'))

  http.createServer(function (req, res) {
    var parsed = url.parse(req.url)
    var q = querystring.parse(parsed.query)
    var str = req.method + ' ' + parsed.pathname
    var m = router.match(str)
    console.log(str)
    if (m) {
      m.fn.apply(null, [req, res, q, m.params, m.splats, utils])
    } else {
      res.statusCode = 404
      res.end('no such route')
    }
  })
  .listen(5000, function () {
    console.log('listening on', this.address().address, 'port', this.address().port)
  })
}

function loadProjects (cb) {
  fs.readdir('projects', function (err, files) {
    if (err) return cb(err)
    var pending = 1
    files.forEach(function (file) {
      if (!/^[A-Fa-f0-9]{64}$/.test(file)) return
      ++pending
      var core = loadProject(file)
      core.osm.ready(function () {
        console.log('Loaded', file)
        if (!--pending) cb()
      })
    })
    if (!--pending) cb()
  })
}

// Loads a project + starts swarming
function loadProject (pid) {
  if (projectCores[pid]) return projectCores[pid]
  var ppid = hash(pid)

  mkdirp.sync(path.join('projects', pid))
  var dbdir = path.join('projects', pid, 'db')
  var osm = Osm({ dir: dbdir, encryptionKey: pid })
  var media = Blob(path.join('projects', pid, 'media'))

  projectCores[pid] = new Mapeo(osm, media)
  projectCores[pid].sync.setName('mapeo-web')  // TODO: some way for the operator to provide this
  projectCores[pid].sync.listen()
  projectCores[pid].sync.join(pid)
  projectCores[pid]._pid = pid
  projectCores[pid]._ppid = ppid
  ppidToCore[ppid] = projectCores[pid]

  return projectCores[pid]
}

function getProject (pid) {
  return projectCores[pid]
}

function getProjectIdFromPpid (ppid) {
  return ppidToCore[ppid]._pid
}

function removeProject (pid, cb) {
  var core = getProject(pid)
  if (!core) return process.nextTick(cb)
  core.close(function () {
    fs.rename(path.join('projects', pid), path.join('projects', 'dead-'+String(Math.random()).slice(2)), cb)
    delete projectCores[pid]
  })
}

// key is String or Buffer
function hash (key) {
  if (typeof key === 'string') {
    key = Buffer.from(key, 'hex')
  }
  if (Buffer.isBuffer(key) && key.length === 32) {
    return crypto.discoveryKey(key).toString('hex')
  } else {
    throw new Error('hash input must be a 32-byte buffer')
  }
}
