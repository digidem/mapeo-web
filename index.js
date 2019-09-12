var http = require('http')

http.createServer(function (req, res) {
  res.statusCode = 404
  res.end()
})
.listen(5000, function () {
  console.log('listening on', this.address().address, 'port', this.address().port)
})
