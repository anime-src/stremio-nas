const { addonBuilder } = require('stremio-addon-sdk')
const logger = require('./lib/config/logger')
const config = require('./lib/config')

// Internal modules
const manifest = require('./lib/manifest')
const catalogHandler = require('./lib/handlers/catalog')
const metaHandler = require('./lib/handlers/meta')
const streamHandler = require('./lib/handlers/stream')
const Storage = require('./lib/storage')
const fetchFiles = require('./lib/api/media.client')
const IndexManager = require('./lib/services/index.manager')
const PollingService = require('./lib/services/polling.service')

// Initiate the storage
const storage = new Storage({
	entryIndexes: ['itemId'],
	maxSize: config.maxIndexed
})
const metaStorage = new Storage({
	maxSize: config.maxIndexed
})

// Create index manager (shared across handlers)
const indexManager = new IndexManager(storage, metaStorage, config)

// Define the addon
function addon(options) {
	options = options || {}
	const builder = new addonBuilder(manifest)

	builder.defineCatalogHandler(function(args) {
		return catalogHandler(indexManager, args)
	})

	builder.defineMetaHandler(function(args) {
		return metaHandler(indexManager, args)
	})

	builder.defineStreamHandler(function(args) {
		return streamHandler(indexManager, args)
	})
	return builder;
}

// Exported methods
function startIndexing() {
	logger.info('Starting file indexing service')
	
	// Create polling service (uses shared indexManager)
	const pollingService = new PollingService(config, fetchFiles, indexManager)
	
	// Start polling (handles initial fetch + periodic updates)
	pollingService.start().catch((err) => {
		logger.error('Failed to start polling service', { error: err.message, stack: err.stack })
	})
	
	return pollingService
}

module.exports = { addon, startIndexing }
