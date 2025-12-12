const logger = require('../config/logger')

/**
 * Lightweight index for hybrid approach
 * Stores minimal data (~50 bytes per file) for fast catalog/stream operations
 * Full details are fetched on-demand from the API server when needed
 * 
 * Memory footprint: ~5MB for 100K files (vs ~200MB with full storage)
 */
class LightweightIndex {
	constructor() {
		// Map<itemId, FileInfo[]> - Pre-aggregated by IMDB ID
		// Example: "local:tt123456" -> [{ id: 1, name: "Movie.mkv", ... }, ...]
		this.imdbIndex = new Map()
		
		// Map<file_id, FileInfo> - For quick file lookups by ID
		this.fileIndex = new Map()
	}

	/**
	 * Update index from API files
	 * Aggregation happens here at index-time instead of query-time
	 * @param {Array} files - Array of file objects from API
	 */
	updateFromFiles(files) {
		this.imdbIndex.clear()
		this.fileIndex.clear()

		files.forEach(file => {
			if (!file.imdb_id) return // Skip files without IMDB ID

			// Store only minimal info (~50 bytes per file)
			const fileInfo = {
				id: file.id,
				imdb_id: file.imdb_id,
				name: file.parsedName || file.name,
				type: file.type || 'movie', // movie or series
				season: file.season || null,
				episode: file.episode || null
			}

			// Index by file ID for quick lookup
			this.fileIndex.set(file.id, fileInfo)

			// Pre-aggregate by IMDB ID (replaces getAggrEntry logic)
			const itemId = 'local:' + file.imdb_id
			if (!this.imdbIndex.has(itemId)) {
				this.imdbIndex.set(itemId, [])
			}
			this.imdbIndex.get(itemId).push(fileInfo)
		})

		logger.info('Lightweight index updated', {
			totalFiles: this.fileIndex.size,
			uniqueImdb: this.imdbIndex.size,
			memoryEstimate: `${Math.round((this.fileIndex.size * 50) / 1024 / 1024 * 100) / 100}MB`
		})
	}

	/**
	 * Get all IMDB item IDs for catalog
	 * @returns {Array<string>} - Array of itemIds
	 */
	getAllItemIds() {
		return Array.from(this.imdbIndex.keys())
	}

	/**
	 * Get aggregated entry by itemId (lightweight version)
	 * Returns minimal info - full details fetched on-demand
	 * @param {string} itemId - Item ID (e.g., "local:tt123456")
	 * @returns {Object|null} - Lightweight entry or null
	 */
	getByItemId(itemId) {
		const files = this.imdbIndex.get(itemId)
		if (!files || files.length === 0) return null

		// Return aggregated entry with minimal info
		return {
			itemId: itemId,
			name: files[0].name,
			files: files, // Already aggregated by IMDB ID!
			type: files[0].type
		}
	}

	/**
	 * Check if itemId exists in index
	 * @param {string} itemId - Item ID to check
	 * @returns {boolean} - True if exists
	 */
	hasItemId(itemId) {
		return this.imdbIndex.has(itemId)
	}

	/**
	 * Get file by ID (for stream handler)
	 * @param {number|string} fileId - File ID
	 * @returns {Object|undefined} - File info or undefined
	 */
	getFileById(fileId) {
		return this.fileIndex.get(Number(fileId))
	}

	/**
	 * Get all files for an IMDB ID
	 * @param {string} itemId - Item ID
	 * @returns {Array} - Array of file info objects
	 */
	getFilesByItemId(itemId) {
		return this.imdbIndex.get(itemId) || []
	}

	/**
	 * Get entries Map for a specific itemId
	 * @param {string} itemId - Item ID
	 * @returns {Map} - Map with single entry (for compatibility)
	 */
	getEntriesForItemId(itemId) {
		const files = this.imdbIndex.get(itemId)
		if (!files || files.length === 0) {
			return new Map()
		}
		
		// Return Map for compatibility with stream handler
		const entry = {
			itemId: itemId,
			name: files[0].name,
			files: files,
			type: files[0].type
		}
		
		const result = new Map()
		result.set(itemId, entry)
		return result
	}

	/**
	 * Get index statistics
	 * @returns {Object} - Stats object
	 */
	getStats() {
		return {
			totalFiles: this.fileIndex.size,
			uniqueImdb: this.imdbIndex.size,
			memoryEstimateMB: Math.round((this.fileIndex.size * 50) / 1024 / 1024 * 100) / 100
		}
	}

	/**
	 * Clear all indexes
	 */
	clear() {
		const size = this.fileIndex.size
		this.imdbIndex.clear()
		this.fileIndex.clear()
		logger.info('Lightweight index cleared', { entriesRemoved: size })
	}

	/**
	 * Get size (number of files)
	 * @returns {number} - Number of files in index
	 */
	get size() {
		return this.fileIndex.size
	}
}

module.exports = LightweightIndex

