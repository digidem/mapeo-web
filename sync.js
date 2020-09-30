var Mapeo = require('@mapeo/core')
var Osm = require('osm-p2p')
var Blob = require('safe-fs-blob-store')

var pid = argv._[0]
var port = arv._[1]

mkdirp.sync(path.join('projects', pid))
var dbdir = path.join('projects', pid, 'db')
var osm = Osm({ dir: dbdir, encryptionKey: pid })
var media = Blob(path.join('projects', pid, 'media'))

projectCores[pid] = new Mapeo(osm, media, { internetDiscovery: true })
projectCores[pid].sync.setName('mapeo-web') // TODO: some way for the operator to provide this
projectCores[pid].sync.listen()
projectCores[pid].sync.join(pid)

return projectCores[pid]

