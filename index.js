var http = require('http')
var routes = require('routes')

var router = routes()
/*
 * intro page
 * project info / control
 * geojson export /w filter
 */
router.addRoute('GET /', require('./routes/main'))

http.createServer(function (req, res) {
  var m
  if (m = router.match(req.method + ' ' + req.url)) {
    m.fn.apply(null, [req, res, m.params, m.splats])
  } else {
    res.statusCode = 404
    res.end('no such route')
  }
})
.listen(5000, function () {
  console.log('listening on', this.address().address, 'port', this.address().port)
})
