var http = require('http')
var url = require('url')
var querystring = require('querystring')
var routes = require('routes')

var router = routes()
/*
 * intro page
 * project info / control
 * geojson export /w filter
 */
router.addRoute('GET /', require('./routes/main'))
router.addRoute('GET /project/:project_id', require('./routes/project').overview)

http.createServer(function (req, res) {
  var parsed = url.parse(req.url)
  var q = querystring.parse(parsed.query)
  var str = req.method + ' ' + parsed.pathname
  var m = router.match(str)
  console.log(str)
  if (m) {
    m.fn.apply(null, [req, res, q, m.params, m.splats])
  } else {
    res.statusCode = 404
    res.end('no such route')
  }
})
.listen(5000, function () {
  console.log('listening on', this.address().address, 'port', this.address().port)
})
