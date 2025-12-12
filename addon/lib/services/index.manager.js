const logger = require('../config/logger')
const fetchMetadata = require('../api/cinemeta.client')
const path = require('path')

/**
 * Index Manager
 * Manages file indexing operations and storage
 */
class IndexManager {
	constructor(storage, metaStorage, config) {
		this.storage = storage
		this.metaStorage = metaStorage
		this.config = config
	}

	/**
	 * Add or update a file in the index
	 * @param {Object} fileData - File data from API
	 * @returns {boolean} - True if file was indexed, false if skipped
	 */
	addFile(fileData) {
		const filePath = fileData.id || fileData.name
		
		// Skip conditions
		if (!fileData.imdb_id) {
			logger.debug('Skipping file without IMDB ID', { name: fileData.name })
			return false
		}
		
		if (this.storage.size >= this.config.maxIndexed) {
			logger.warn('Max indexed files reached', { maxIndexed: this.config.maxIndexed })
			return false
		}
		
		const entry = this._buildVideoEntry(fileData)
		this._saveEntry(filePath, entry)
		this._createMetaEntry(entry, fileData)
		
		logger.debug('File indexed', { filePath, itemId: entry.itemId, imdb_id: fileData.imdb_id })
		return true
	}

	/**
	 * Remove a file from the index
	 * @param {string|number} fileId - File ID to remove
	 */
	removeFile(fileId) {
		const filePath = fileId
		this.storage.removeEntry(filePath)
		logger.debug('File removed from index', { filePath })
	}

	/**
	 * Update a file in the index (remove then add)
	 * @param {Object} fileData - Updated file data
	 */
	updateFile(fileData) {
		const filePath = fileData.id || fileData.name
		this.removeFile(filePath)
		this.addFile(fileData)
	}

	/**
	 * Clear all indexed files
	 */
	clear() {
		this.storage.clear()
		this.metaStorage.clear()
		logger.info('Index cleared')
	}

	/**
	 * Get index statistics
	 * @returns {Object} - Index stats
	 */
	getStats() {
		return {
			totalFiles: this.storage.size,
			totalMeta: this.metaStorage.size,
			maxIndexed: this.config.maxIndexed
		}
	}

	/**
	 * Get all item IDs for catalog listing
	 * @returns {Array} - Array of [itemId, entries] tuples
	 */
	getAllItemIds() {
		return this.storage.getAllFromIndex('itemId')
	}

	/**
	 * Get aggregated entry by itemId
	 * @param {string} itemId - Item ID to look up
	 * @returns {Object|null} - Entry or null if not found
	 */
	getEntryByItemId(itemId) {
		return this.storage.getAggrEntry('itemId', itemId, ['files'])
	}

	/**
	 * Check if itemId exists
	 * @param {string} itemId - Item ID to check
	 * @returns {boolean} - True if exists
	 */
	hasItemId(itemId) {
		return this.storage.hasInIndex('itemId', itemId)
	}

	/**
	 * Get entries Map for a specific itemId
	 * @param {string} itemId - Item ID
	 * @returns {Map} - Map of entries or empty Map
	 */
	getEntriesForItemId(itemId) {
		return this.storage.getFromIndex('itemId', itemId)
	}

	/**
	 * Get meta from storage
	 * @param {string} itemId - Item ID
	 * @returns {Object|null} - Meta object or null
	 */
	getMeta(itemId) {
		return this.metaStorage.getEntry(itemId) || null
	}

	/**
	 * Build video entry from file data
	 * @private
	 */
	_buildVideoEntry(fileData) {
		const nameWithoutExt = fileData.parsedName || path.parse(fileData.name).name
		const itemId = 'local:' + fileData.imdb_id
		
		return {
			itemId: itemId,
			name: fileData.name,
			files: [{
				// Basic file info
				id: fileData.id,
				name: fileData.name,
				length: fileData.size,
				type: fileData.fileType || fileData.type || 'movie',
				parsedName: nameWithoutExt,
				
				// IMDB info
				imdb_id: fileData.imdb_id,
				season: fileData.season || null,
				episode: fileData.episode || null,
				
				// Video metadata
				resolution: fileData.resolution || null,
				source: fileData.source || null,
				videoCodec: fileData.videoCodec || null,
				audioCodec: fileData.audioCodec || null,
				audioChannels: fileData.audioChannels || null,
				languages: fileData.languages || null,
				releaseGroup: fileData.releaseGroup || null,
				flags: fileData.flags || null,
				edition: fileData.edition || null,
				
				// IMDB metadata
				imdbName: fileData.imdbName || null,
				imdbYear: fileData.imdbYear || null,
				imdbType: fileData.imdbType || null,
				yearRange: fileData.yearRange || null,
				image: fileData.image || null,
				starring: fileData.starring || null,
				similarity: fileData.similarity || null
			}]
		}
	}

	/**
	 * Save entry to storage (upsert - creates or updates)
	 * @private
	 */
	_saveEntry(filePath, entry) {
		try {
			this.storage.setEntry(filePath, entry)
		} catch (err) {
			logger.error('Error saving entry', { 
				filePath, 
				itemId: entry.itemId, 
				error: err.message 
			})
		}
	}

	/**
	 * Create meta entry with rich metadata
	 * @private
	 */
	_createMetaEntry(entry, fileData) {
		if (!entry.files?.length || !entry.itemId) return
		
		fetchMetadata(entry)
			.then((meta) => {
				try {
					this.metaStorage.setEntry(meta.id, meta)
				} catch (err) {
					logger.error('Error saving metadata', { itemId: meta.id, error: err.message })
				}
			})
			.catch(() => {
				// Fallback to simple meta
				const nameWithoutExt = fileData.parsedName || path.parse(fileData.name).name
				const simpleMeta = {
					id: entry.itemId,
					type: fileData.fileType || fileData.type || 'movie',
					name: nameWithoutExt,
					poster: null
				}
				try {
					this.metaStorage.setEntry(simpleMeta.id, simpleMeta)
				} catch (err) {
					logger.error('Error saving simple metadata', { itemId: simpleMeta.id, error: err.message })
				}
			})
	}
}

module.exports = IndexManager

