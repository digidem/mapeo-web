#!/usr/bin/env node

const DEFAULT_STORAGE = require('env-paths')('mapeo-web').data
// If a mapeo instance hasn't been accessed for a minute, we should clear it out
const DEFAULT_GC_DELAY = 60 * 1000
const HOSTNAME = require('os').hostname()
const DEFAULT_NAME = 'Mapeo@' + HOSTNAME

require('yargs')
  .scriptName('mapeo-web')
  .option('p', {
    alias: 'port',
    describe: 'The port to listen on HTTP connections from',
    type: 'number',
    default: 0
  })
  .option('s', {
    alias: 'storage-location',
    describe: 'Where to store data for mapeo-web',
    type: 'string',
    default: DEFAULT_STORAGE
  })
  .option('n', {
    alias: 'name',
    describe: 'The name to display to peers',
    type: 'string',
    default: DEFAULT_NAME
  })
  .option('gc-delay', {
    describe: 'Delay until instances are released for garbage collection',
    type: 'number',
    default: DEFAULT_GC_DELAY
  })
  .command('$0', 'run the mapeo-web server', () => {}, (argv) => {
    const MapeoWeb = require('./')
    const mapeoWeb = MapeoWeb.create(argv)

    const { port } = argv

    mapeoWeb.listen(port, () => {
      console.log('Starting service', mapeoWeb.address())
    })
  })
  .parse()
