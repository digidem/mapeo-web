var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var rimraf = require('rimraf')
var crypto = require('crypto')

module.exports = overview

// TODO: use nanohtml for html escaping of user input

function overview (req, res, q, params, splats, utils) {
  var pid = params.project_id
  var html

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
        var core = utils.getOrCreateProject(pid)
        renderProject(core, pid, done)
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

function renderProject (core, pid, cb) {
  var footer = `
    <hr/>
    <p><font color="red">DANGER ZONE:</font></p>
    <form>
      <input type="hidden" name="delete" value="true"/>
      <input type="submit" value="delete project"/>
    </form>
  `

  // protected (hashed) project id
  var ppid = crypto.createHash('sha256').update(pid, 'utf8').digest().toString('hex')

  var header = '<h2>GeoJSON filters</h2>'
  var html = '<ul>'
  var pending = 1
  var seen = 0
  core.osm.ready(function () {
    core.osm.core.api.types.createReadStream('filter')
      .on('data', function (entry) {
        ++pending
        core.osm.getByVersion(entry.version, function (err, filter) {
          if (filter) {
            html += `<li><a href="/project/${ppid}/filters/${filter.version}/export.geojson">${filter.name}</a></li>`
            ++seen
          }
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

function isValidProjectId (pid) {
  return typeof pid === 'string' && Buffer.from(pid, 'hex').length === 32
}

