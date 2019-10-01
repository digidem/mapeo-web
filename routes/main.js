module.exports = handle

function handle (req, res, q, params, splats) {
  if (q.project_id) {
    return redirect(res, '/project/' + q.project_id + '/')
  }

  var html = `
    <title>mapeo-web</title>
    <body>
      <h1>mapeo-web</h1>
      <p>welcome to mapeo-web. enter a project id to view or enable that project.</p>
      <form>
        <label for="project_id">project id:</label>
        <input name="project_id" type="text"></input>
        <input type="submit" value="open"></input>
      </form>
    </body>
  `
  res.end(html)
}

function redirect (res, to) {
  res.writeHead(302, {
    Location: to
  })
  res.end()
}

