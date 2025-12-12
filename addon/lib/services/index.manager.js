const logger = require('../config/logger')
const fetchMetadata = require('../api/cinemeta.client')
const { LRUCache } = require('lru-cache')

/**
 * Index Manager for Hybrid approach (Option 4)
 * Manages lightweight index + on-demand fetching with LRU cache
 * 
 * Architecture:
 * - Lightweight index: Fast access to file IDs and basic info
 * - LRU cache: Caches full file details and metadata for recently accessed items
 * - On-demand: Fetches full details from API server when not in cache
 */
class IndexManager {
	constructor(lightweightIndex, config, fetchFilesFn) {
		this.index = lightweightIndex
		this.config = config
		this.fetchFiles = fetchFilesFn
		
		// LRU cache for full file details
		this.fullDetailsCache = new LRUCache({
			max: 1000, // Cache last 1000 accessed items
			ttl: 1000 * 60 * 30, // 30 minutes TTL
			updateAgeOnGet: true
		})
		
		// LRU cache for enriched metadata
		this.metaCache = new LRUCache({
			max: 1000,
			ttl: 1000 * 60 * 30, // 30 minutes TTL
			updateAgeOnGet: true
		})
	}

	/**
	 * Update index from files (batch operation)
	 * @param {Array} files - Array of file objects from API
	 * @returns {Object} - Update stats
	 */
	updateFromFiles(files) {
		const before = this.index.size
		
		// Filter files with IMDB IDs
		const filtered = files.filter(f => f.imdb_id)
		
		// Update lightweight index
		this.index.updateFromFiles(filtered)
		
		const stats = {
			total: files.length,
			indexed: filtered.length,
			skipped: files.length - filtered.length,
			added: this.index.size - before,
			removed: 0,
			updated: 0
		}
		
		logger.debug('Index updated from files', stats)
		return stats
	}

	/**
	 * Get all item IDs for catalog
	 * @returns {Array<string>} - Array of itemIds
	 */
	getAllItemIds() {
		const itemIds = this.index.getAllItemIds()
		// Return in format expected by catalog handler: [[itemId, entries], ...]
		return itemIds.map(itemId => [itemId, null])
	}

	/**
	 * Get lightweight entry by itemId
	 * @param {string} itemId - Item ID
	 * @returns {Object|null} - Lightweight entry or null
	 */
	getEntryByItemId(itemId) {
		return this.index.getByItemId(itemId)
	}

	/**
	 * Check if itemId exists
	 * @param {string} itemId - Item ID to check
	 * @returns {boolean} - True if exists
	 */
	hasItemId(itemId) {
		return this.index.hasItemId(itemId)
	}

	/**
	 * Get entries Map for a specific itemId
	 * @param {string} itemId - Item ID
	 * @returns {Map} - Map of entries
	 */
	getEntriesForItemId(itemId) {
		return this.index.getEntriesForItemId(itemId)
	}

	/**
	 * Get full file details with caching (on-demand fetch)
	 * This is called by meta handler when detailed info is needed
	 * @param {string} itemId - Item ID
	 * @returns {Promise<Array|null>} - Array of full file objects or null
	 */
	async getFullDetails(itemId) {
		// Check cache first
		const cached = this.fullDetailsCache.get(itemId)
		if (cached) {
			logger.debug('Cache hit for full details', { itemId })
			return cached
		}

		// Fetch from server with IMDB ID filter
		const imdbId = itemId.replace('local:', '')
		try {
			logger.debug('Fetching full details from API', { itemId, imdbId })
			
			// Fetch only files for this IMDB ID (efficient!)
			const files = await this.fetchFiles({ imdb_id: imdbId })
			
			if (files.length === 0) {
				logger.warn('No files found for IMDB ID', { itemId, imdbId })
				return null
			}
			
			// Files now have clean 'type' field (movie/series) from API
			const normalizedFiles = files.map(file => ({
				...file,
				type: file.type || 'movie' // Fallback to movie if missing
			}))
			
			// Cache for future requests
			this.fullDetailsCache.set(itemId, normalizedFiles)
			logger.debug('Fetched and cached full details', { 
				itemId, 
				fileCount: normalizedFiles.length 
			})
			
			return normalizedFiles
		} catch (err) {
			logger.error('Failed to fetch full details', { 
				itemId, 
				error: err.message,
				stack: err.stack 
			})
			return null
		}
	}

	/**
	 * Get or fetch enriched metadata with caching
	 * @param {string} itemId - Item ID
	 * @returns {Object|null} - Metadata object or null
	 */
	getMeta(itemId) {
		return this.metaCache.get(itemId) || null
	}

	/**
	 * Set cached metadata
	 * @param {string} itemId - Item ID
	 * @param {Object} meta - Metadata object
	 */
	setMeta(itemId, meta) {
		this.metaCache.set(itemId, meta)
	}

	/**
	 * Get index statistics
	 * @returns {Object} - Stats object
	 */
	getStats() {
		return {
			...this.index.getStats(),
			fullDetailsCacheSize: this.fullDetailsCache.size,
			metaCacheSize: this.metaCache.size,
			maxCacheSize: this.fullDetailsCache.max
		}
	}

	/**
	 * Clear index and all caches
	 */
	clear() {
		this.index.clear()
		this.fullDetailsCache.clear()
		this.metaCache.clear()
		logger.info('Index and all caches cleared')
	}

	/**
	 * Remove a file from index (for future use)
	 * @param {string|number} fileId - File ID
	 */
	removeFile(fileId) {
		// Note: Lightweight index doesn't support individual removal
		// Would need full re-index from API
		logger.warn('Individual file removal not supported in lightweight mode', { fileId })
	}

	/**
	 * Update a file in index (for future use)
	 * @param {Object} fileData - File data
	 */
	updateFile(fileData) {
		// Note: Would need full re-index from API
		logger.warn('Individual file update not supported in lightweight mode', { 
			fileId: fileData.id 
		})
	}
}

module.exports = IndexManager
