module.exports = overview

function overview (req, res, q, params, splats, utils) {
  var discoveryKey = params.discovery_key
  var pid = utils.getProjectId(discoveryKey)

  if (!pid) {
    res.statusCode = 500
    let err = new Error('Project unknown')
    err.code = 1
    return onError(err)
  }

  utils.loadProject(pid, (err, project) => {
    res.setHeader('Content-Type', 'application/json')
    if (err) return onError(err)
    return res.end(JSON.stringify({
      error: false,
      port: project.port
    }))
  })

  function onError (err) {
    let _err = new Error('Error loading project:', err.message)
    _err.code = 2
    return res.end(JSON.stringify({
      error: true,
      message: _err.message,
      code: _err.code
    }))
  }
}
