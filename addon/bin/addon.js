#!/usr/bin/env node

const { serveHTTP } = require('stremio-addon-sdk')
const localAddon = require('..')

const port = process.env.PORT || 1222
const storagePath = process.env.STORAGE_PATH || './localFiles'

const builder = localAddon.addon()
serveHTTP(builder.getInterface(), { port })

localAddon.startIndexing(storagePath)
