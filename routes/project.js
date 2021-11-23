var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')

module.exports = overview

function overview (req, res, q, params, splats, utils) {
  var pid = utils.getProjectId(params.discovery_key)

  if (!isValidProjectId(pid)) {
    return done(new Error('bad project id'))
  }

  // delete project
  if (q.delete === 'true') {
    utils.removeProject(pid, function (err) {
      if (err) done(err)
      else done(null, '<p>project deleted</p>')
    })
    return
  }

  // create a project stub
  if (q.seed === 'true') {
    mkdirp(path.join('projects', pid), function (err) {
      if (err) return done(err)
      check()
    })
  } else {
    check()
  }

  // see if project exists locally
  function check () {
    fs.stat(path.join('projects', pid), function (err, stats) {
      if (err && err.code === 'ENOENT') {
        done(null, renderNewProject(pid))
      } else if (err) {
        done(err)
      } else {
        var project = utils.getProject(pid)
        renderProject(project, done)
      }
    })
  }

  function done (err, html) {
    var body = `
      <title>mapeo-web</title>
      <body>
        <h1>project overview</h1>
        <blockquote><i>${pid}</i></blockquote>
        ${err ? renderError(err) : html}
      </body>
    `
    res.end(body)
  }
}

function renderProject (project, cb) {
  cb(`
    <hr/>
    <p><font color="red">DANGER ZONE:</font></p>
    <form>
      <input type="hidden" name="delete" value="true"/>
      <input type="submit" value="delete project"/>
    </form>
  `)
  /*

  var header = '<h2>GeoJSON filters</h2>'
  var html = '<ul>'
  var pending = 1
  var seen = 0
  core.osm.ready(function () {
    core.osm.core.api.filtermap.createReadStream()
      .on('data', function (entry) {
        var filter = entry.value.value
        var exportId = entry.key
        html += `<li><a href="/export/${exportId}.geojson">${filter.name}</a></li>`
        ++pending
        ++seen
        if (!--pending) done()
      })
      .on('end', function () {
        if (!--pending) {
          done()
        }
      })
  })

  function done () {
    html += '</ul>'
    if (!seen) {
      html = '<p>there are no filters present on this project</p>'
    }

    cb(null, header + html + footer)
  }
  */
}

function renderError (err) {
  return `<font color=red>ERROR: ${err.toString()}</font>`
}

function renderNewProject (pid) {
  return `
    <p>This project is not currently hosted here. Would you like to have mapeo-web start seeding this project and its data?</p>
    <p>
      <i>Warning: this will enable any internet-capable computer with knowledge of this project ID to download & upload data to this project via this service.</i>
    </p>
    <form>
      <input type="hidden" name="seed" value="true"/>
      <input type="submit" value="seed"/>
    </form>
  `
}

function isValidProjectId (pid) {
  return typeof pid === 'string' && Buffer.from(pid, 'hex').length === 32
}
