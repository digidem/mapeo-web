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

// projectId => mapeo-core instance
var projectCores = {}

var utils = {
  getOrCreateProject,
  getProject,
  removeProject
}

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

function getOrCreateProject (pid) {
  if (!projectCores[pid]) {
    mkdirp.sync(path.join('projects', pid))
    var osm = Osm(path.join('projects', pid, 'db'))
    var media = Blob(path.join('projects', pid, 'media'))
    projectCores[pid] = new Mapeo(osm, media)
  }
  return projectCores[pid]
}

function getProject (pid) {
  if (projectCores[pid]) return projectCores[pid]

  try {
    fs.statSync(path.join('projects', pid))
    var osm = Osm(path.join('projects', pid, 'db'))
    var media = Blob(path.join('projects', pid, 'media'))
    return projectCores[pid] = new Mapeo(osm, media)
  } catch (e) {
    return null
  }
}

function removeProject (pid, cb) {
  var core = getOrCreateProject(pid)
  core.close(function () {
    fs.rename(path.join('projects', pid), path.join('projects', 'dead-'+String(Math.random()).slice(2)), cb)
  })
}

