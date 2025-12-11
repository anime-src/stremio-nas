const { addonBuilder } = require('stremio-addon-sdk')
const logger = require('./lib/config/logger')

// Variables
let engineUrl = 'http://127.0.0.1:11470'
// MEDIA_API_URL environment variable is used by apiClient module
// Set it to your Media API server URL, e.g., 'http://your-server-ip:3000'

// Internal modules
const manifest = require('./lib/manifest')
const catalogHandler = require('./lib/handlers/catalog')
const metaHandler = require('./lib/handlers/meta')
const streamHandler = require('./lib/handlers/stream')
const Storage = require('./lib/storage')
const createApiClient = require('./lib/api')
const mapEntryToMeta = require('./lib/utils/mapEntryToMeta')

const MAX_INDEXED = 10000

// Initiate the storage
const storage = new Storage({
	entryIndexes: ['itemId'],
})
const metaStorage = new Storage()

// Define the addon
function addon(options) {
	options = options || {}
	const builder = new addonBuilder(manifest)

	builder.defineCatalogHandler(function(args) {
		return catalogHandler(storage, metaStorage, args)
	})

	builder.defineMetaHandler(function(args) {
		return metaHandler(storage, metaStorage, args)
	})

	builder.defineStreamHandler(function(args) {
		return streamHandler(storage, args)
	})
	return builder;
}

// Exported methods
function setEngineUrl(url) {
	engineUrl = url
}

function logError(err) {
	logger.error('Error loading storage', { error: err.message, stack: err.stack });
}

function startIndexing(fPath) {
	// NOTE: storage.load just loads existing records from the fs
	// we don't need to wait for it in order to use the storage, so we don't wait for it
	// to start the add-on and we don't consider it fatal if it fails
	Promise.all([
		metaStorage.load(fPath+'Meta').catch(logError),
		storage.load(fPath).catch(logError)
	])
	.then(function(err) {
		// Start indexing
		logger.info('Starting file discovery')
		const apiClient = createApiClient()
		apiClient.on('file', function(fileData) {
			logger.debug('File discovered', { name: fileData.name || fileData.id, imdb_id: fileData.imdb_id })
			onDiscoveredFile(fileData)
		})
		apiClient.on('finished', function() {
			logger.info('File discovery finished')
		})
		apiClient.on('err', function(err) {
			logger.error('File discovery error', { error: err.message, stack: err.stack })
		})
	})
}

// Internal methods
function onDiscoveredFile(fileData) {
	// fileData: { type: 'video', id, name, path, size, url, imdb_id, ... }
	const filePath = fileData.id || fileData.name
	
	// Early returns for skip conditions
	if (storage.indexes.primaryKey.has(filePath)) return
	if (storage.indexes.primaryKey.size >= MAX_INDEXED) return
	if (!fileData.imdb_id) return // Only index files with IMDB IDs
	
	const entry = buildVideoEntry(fileData)
	saveEntry(filePath, entry)
	createMetaEntry(entry, fileData)
}

function buildVideoEntry(fileData) {
	const path = require('path')
	const nameWithoutExt = fileData.parsedName || path.parse(fileData.name).name
	const itemId = 'local:' + fileData.imdb_id
	
	return {
		itemId: itemId,
		name: fileData.name,
		files: [{
			// Basic file info
			id: fileData.id,  // Database ID for stream URL construction
			name: fileData.name,
			length: fileData.size,
			type: fileData.fileType || fileData.type || 'movie',
			parsedName: nameWithoutExt,
			
			// IMDB info
			imdb_id: fileData.imdb_id,
			season: fileData.season || null,
			episode: fileData.episode || null,
			
			// Video metadata (from filename parsing)
			resolution: fileData.resolution || null,
			source: fileData.source || null,
			videoCodec: fileData.videoCodec || null,
			audioCodec: fileData.audioCodec || null,
			audioChannels: fileData.audioChannels || null,
			languages: fileData.languages || null,
			releaseGroup: fileData.releaseGroup || null,
			flags: fileData.flags || null,
			edition: fileData.edition || null,
			
			// IMDB metadata (from name-to-imdb lookup)
			imdbName: fileData.imdbName || null,
			imdbYear: fileData.imdbYear || null,
			imdbType: fileData.imdbType || null,
			yearRange: fileData.yearRange || null,
			image: fileData.image || null,  // Stored but not used (we use Metahub URLs)
			starring: fileData.starring || null,
			similarity: fileData.similarity || null
		}]
	}
}

function saveEntry(filePath, entry) {
	storage.saveEntry(filePath, entry, function(err) {
		if (err) {
			logger.error('Error saving entry', { filePath, itemId: entry.itemId, error: err.message, stack: err.stack })
		} else {
			logger.debug('Entry indexed', { filePath, itemId: entry.itemId })
		}
	})
}

function createMetaEntry(entry, fileData) {
	if (!entry.files?.length || !entry.itemId) return
	
	mapEntryToMeta(entry)
		.then(function(meta) {
			metaStorage.saveEntry(meta.id, meta, function() {})
		})
		.catch(() => {
			// Fallback to simple meta if rich metadata fails
			const path = require('path')
			const nameWithoutExt = fileData.parsedName || path.parse(fileData.name).name
			const simpleMeta = {
				id: entry.itemId,
				type: fileData.fileType || fileData.type || 'movie',
				name: nameWithoutExt,
				poster: null
			}
			metaStorage.saveEntry(simpleMeta.id, simpleMeta, function() {})
		})
}

module.exports = { addon, setEngineUrl, startIndexing }
