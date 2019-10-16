#!/usr/bin/env node

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
var parallel = require('run-parallel')
var helpers = require('./lib/utils')
var filtermap = require('./lib/filtermap')

// projectId => mapeo-core instance
var projectCores = {}

var utils = {
  getOrCreateProject: loadProject,
  getProject,
  removeProject,
  getProjectIdAndFilterIdFromExportId,
  hash: helpers.discoveryHash
}

loadProjects(function (err) {
  if (err) throw err
  startServer()
})

function startServer () {
  var router = routes()
  router.addRoute('GET /', require('./routes/main'))
  router.addRoute('GET /project/:project_id', require('./routes/project'))
  router.addRoute('GET /export/:export_id.geojson', require('./routes/export'))

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
      var address = this.address().address
      if (address === '::') address = '0.0.0.0'
      console.log(`Listening on http://${address}:${this.address().port}`)
    })
}

function loadProjects (cb) {
  mkdirp.sync('projects')
  fs.readdir('projects', function (err, files) {
    if (err) return cb(err)
    var pending = 1
    files.forEach(function (file) {
      if (!/^[A-Fa-f0-9]{64}$/.test(file)) return
      ++pending
      var core = loadProject(file)
      core.osm.ready(function () {
        var ok = '[ OK ]'
        var padding = new Array(process.stdout.columns - file.length - ok.length).fill(' ').join('')
        console.log(file + padding + ok)
        if (!--pending) cb()
      })
    })
    if (!--pending) cb()
  })
}

// Loads a project + starts swarming
function loadProject (pid) {
  if (projectCores[pid]) return projectCores[pid]

  mkdirp.sync(path.join('projects', pid))
  var dbdir = path.join('projects', pid, 'db')
  var osm = Osm({ dir: dbdir, encryptionKey: pid })
  var media = Blob(path.join('projects', pid, 'media'))

  projectCores[pid] = new Mapeo(osm, media, { internetDiscovery: true })
  projectCores[pid].sync.setName('mapeo-web') // TODO: some way for the operator to provide this
  projectCores[pid].sync.listen()
  projectCores[pid].sync.join(pid)

  // provides a reverse map of HASH => projectId
  osm.core.use('filtermap', filtermap(pid))

  return projectCores[pid]
}

function getProject (pid) {
  return projectCores[pid]
}

function removeProject (pid, cb) {
  var core = getProject(pid)
  if (!core) return process.nextTick(cb)
  core.close(function () {
    fs.rename(path.join('projects', pid), path.join('projects', 'dead-' + String(Math.random()).slice(2)), cb)
    delete projectCores[pid]
  })
}

// Q: how to avoid needing to scan every core?
function getProjectIdAndFilterIdFromExportId (exportId, cb) {
  var tasks = Object.values(projectCores)
    .map(function (core) {
      return function (cb) {
        core.osm.ready(function () {
          core.osm.core.api.filtermap.get(exportId, function (err, values) {
            if (err && err.notFound) err = null
            if (err) return cb(err)
            if (!values || !values.length) return cb()
            var filter = values[0].value
            cb(null, [core, filter])
          })
        })
      }
    })

  parallel(tasks, function (err, results) {
    if (err) return cb(err)
    var result = results.filter(function (result) { return !!result })[0]
    if (!result) return cb(new Error('no such export found'))
    cb(null, result[0], result[1])
  })
}
