var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var rimraf = require('rimraf')
var getGeojson = require('../lib/export-geojson')
var pump = require('pump')
var through = require('through2')
var featureFilter = require('feature-filter')

module.exports = geojson

function geojson (req, res, q, params, splats, utils) {
  var pid = params.project_id
  var fid = params.filter_id

  var core = utils.getProject(pid)
  if (!core) {
    return done(new Error('no such project'))
  }

  core.osm.ready(function () {
    core.osm.getByVersion(fid, function (err, filter) {
      if (err) return done(err)
      if (!filter) return done(new Error('no such filter'))
      res.setHeader('Content-Type', 'application/json')
      var filterFn = featureFilter(filter.filter)
      res.write('{"type":"FeatureCollection", "features":[')
      var first = true
      pump(
        core.observationStream(),
        through.obj(function (obs, _, next) {
          var feature = observationToFeature(obs)
          var res = filterFn(feature)
          if (res) {
            var json = JSON.stringify(feature)
            if (!first) json = ','+json
            first = false
            next(null, json)
          } else {
            next()
          }
        }, function (done) {
          res.write(']}')
          done()
        }),
        res
      )
    })
  })

  function done (err, html) {
    res.end(err ? renderError(err) : html)
  }
}

function renderError (err) {
  return `<font color=red>${err.toString()}</font>`
}

function observationToFeature (obs) {
  var feature = {
    id: obs.id,
    type: 'Feature',
    geometry: null,
    properties: {}
  }

  if (obs.lon && obs.lat) {
    feature.geometry = {
      type: 'Point',
      coordinates: [obs.lon, obs.lat]
    }
  }

  Object.keys(obs.tags || {}).forEach(function (key) {
    feature.properties[key] = obs.tags[key]
  })

  feature.properties.media = (obs.attachments || []).map(function (a) {
    return { id: a.id }
    // var id = a.id || a // the phone doesn't have id property on it's attachments.
    // return {
    //   // type: 'image' -- turns on media filtering on the sidebar.
    //   value: `${osmServerHost}/media/original/${id}`
    // }
  })

  feature.properties.timestamp = obs.timestamp
  feature.properties.created_at = obs.created_at

  if (!feature.properties.notes) feature.properties.notes = ' '
  return feature
}