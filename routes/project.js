module.exports = {
  overview
}

function overview (req, res, q, params, splats) {
  var pid = params.project_id

  var html = `
    <title>mapeo-web</title>
    <body>
      <h1>project overview</h1>
      <blockquote><i>${pid}</i></blockquote>
    </body>
  `
  res.end(html)
}
