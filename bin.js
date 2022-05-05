#!/usr/bin/env node

const DEFAULT_STORAGE = require('env-paths')('mapeo-web').data
// If a mapeo instance hasn't been accessed for a minute, we should clear it out
const DEFAULT_GC_DELAY = 60 * 1000
const HOSTNAME = require('os').hostname()
const DEFAULT_NAME = 'Mapeo@' + HOSTNAME

require('yargs')
  .scriptName('mapeo-web')
  .command('$0', 'run the mapeo-web server', (yargs) => {
    yargs.option('p', {
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
  }, (argv) => {
    const MapeoWeb = require('./')
    const mapeoWeb = MapeoWeb.create(argv)

    const { port } = argv

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    function shutdown () {
      mapeoWeb.close(() => {
        process.exit(0)
      })
    }

    mapeoWeb.listen(port)
      .then((address) => console.log(`server listening on ${address}`))
  })
  .command('add <projectKey> <url>', 'Add a project to a mapeo-web server', (yargs) => {
    yargs.positional('projectKey', {
      describe: 'The Mapeo projectKey',
      type: 'string'
    }).positional('url', {
      describe: 'The Mapeo Web instance to connect to',
      type: 'string'
    })
  }, async (argv) => {
    const Client = require('./client')
    const { url, projectKey } = argv

    try {
      const { id } = await Client.add({ url, projectKey })
      console.log(`Added ${projectKey} as ${id}`)
    } catch (e) {
      console.error(`Could not add ${projectKey} to ${url}:\n${e.stack}`)
    }
  })
  .command('remove <projectKey> <url>', 'Remove a project from a mapeo-web server', (yargs) => {
    yargs.positional('projectKey', {
      describe: 'The Mapeo projectKey',
      type: 'string'
    }).positional('url', {
      describe: 'The Mapeo Web instance to connect to',
      type: 'string'
    })
  }, async (argv) => {
    const Client = require('./client')
    const { url, projectKey } = argv

    try {
      await Client.remove({ url, projectKey })
      console.log(`Removed project key ${projectKey}`)
    } catch (e) {
      console.error(`Could not remove ${projectKey} from ${url}:\n${e.stack}`)
    }
  })
  .command('list <url>', 'List known projects on a mapeo-web server', (yargs) => {
    yargs.positional('url', {
      describe: 'The Mapeo Web instance to connect to',
      type: 'string'
    })
  }, async (argv) => {
    const Client = require('./client')
    const { url } = argv

    try {
      const keys = await Client.list({ url })
      console.log(keys)
    } catch (e) {
      console.error(`Could not list projects on ${url}:\n${e.stack}`)
    }
  })
  .parse()
