var path = require('path')
var fs = require('fs')

module.exports = {
  overview
}

// TODO: use nanohtml for html escaping of user input

function overview (req, res, q, params, splats) {
  var pid = params.project_id
  var html

  fs.stat(path.join('projects', pid), function (err, stats) {
    if (err && err.code === 'ENOENT') {
      done(null, renderNewProject(pid))
    } else if (err) {
      done(null, renderError(err))
    } else {
      renderProject(pid, done)
    }
  })

  function done (err, html) {
    var body = `
      <title>mapeo-web</title>
      <body>
        <h1>project overview</h1>
        <blockquote><i>${pid}</i></blockquote>
        ${html}
      </body>
    `
    res.end(body)
  }
}

function renderProject (pid, cb) {
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
      <input type="submit" value="seed"></input>
    </form>
  `
}
