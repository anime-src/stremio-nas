#!/usr/bin/env node

const { serveHTTP } = require('stremio-addon-sdk')
const localAddon = require('..')
const config = require('../lib/config')

const builder = localAddon.addon()
serveHTTP(builder.getInterface(), { port: config.port })

localAddon.startIndexing()
