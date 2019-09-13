var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var rimraf = require('rimraf')

module.exports = {
  overview
}

// TODO: use nanohtml for html escaping of user input

function overview (req, res, q, params, splats, utils) {
  var pid = params.project_id
  var html

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

  function check () {
    fs.stat(path.join('projects', pid), function (err, stats) {
      if (err && err.code === 'ENOENT') {
        done(null, renderNewProject(pid))
      } else if (err) {
        done(err)
      } else {
        var core = utils.getOrCreateProject(pid)
        renderProject(core, done)
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

function renderProject (core, cb) {
  var footer = `
    <hr/>
    <p><font color="red">DANGER ZONE:</font></p>
    <form>
      <input type="hidden" name="delete" value="true"/>
      <input type="submit" value="delete project"/>
    </form>
  `

  var header = '<h2>GeoJSON filters</h2>'
  var html = '<ul>'
  var pending = 1
  var seen = 0
  core.osm.ready(function () {
    core.osm.core.api.types.createReadStream('filter')
      .on('data', function (entry) {
        ++pending
        core.osm.getByVersion(entry.version, function (err, filter) {
          html += `<li>${filter.name}</li>`
          ++seen
          if (!--pending) done()
        })
      })
      .on('end', function () {
        if(!--pending) {
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
