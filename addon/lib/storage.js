const logger = require('./config/logger')

/**
 * In-memory storage with indexing capabilities
 * No file persistence - data is rebuilt from API on each startup
 */
class Storage {
	#indexes = { primaryKey: new Map() }

	constructor(opts = {}) {
		this.opts = {
			entryIndexes: opts.entryIndexes || [],
			maxSize: opts.maxSize || Infinity
		}

		// Create indexes for specified entry properties
		this.opts.entryIndexes.forEach(key => {
			this.#indexes[key] = new Map()
		})
	}

	/**
	 * Get the number of entries in storage
	 * @returns {number} - Number of entries
	 */
	get size() {
		return this.#indexes.primaryKey.size
	}

	/**
	 * Check if entry exists
	 * @param {string} primaryKey - Primary key to check
	 * @returns {boolean} - True if exists
	 */
	hasEntry(primaryKey) {
		return this.#indexes.primaryKey.has(primaryKey)
	}

	/**
	 * Get entry by primary key
	 * @param {string} primaryKey - Primary key
	 * @returns {Object|undefined} - Entry or undefined if not found
	 */
	getEntry(primaryKey) {
		return this.#indexes.primaryKey.get(primaryKey)
	}

	/**
	 * Check if value exists in secondary index
	 * @param {string} indexName - Index name
	 * @param {string} key - Key to check
	 * @returns {boolean} - True if exists
	 */
	hasInIndex(indexName, key) {
		return this.#indexes[indexName]?.has(key) || false
	}

	/**
	 * Get all entries from secondary index
	 * @param {string} indexName - Index name
	 * @returns {Array} - Array of [key, entriesMap] tuples
	 */
	getAllFromIndex(indexName) {
		const index = this.#indexes[indexName]
		if (!index) return []
		return Array.from(index.entries())
	}

	/**
	 * Get entries Map for a specific key in secondary index
	 * @param {string} indexName - Index name
	 * @param {string} key - Key to look up
	 * @returns {Map} - Map of entries or empty Map
	 */
	getFromIndex(indexName, key) {
		return this.#indexes[indexName]?.get(key) || new Map()
	}

	/**
	 * Save entry to indexes (no file persistence)
	 * @param {string} primaryKey - Primary key for the entry
	 * @param {Object} entry - Entry data to index
	 * @throws {Error} If entry with primaryKey already exists or storage is full
	 */
	saveEntry(primaryKey, entry) {
		if (this.#indexes.primaryKey.has(primaryKey)) {
			throw new Error(`Entry with key "${primaryKey}" already exists`)
		}
		
		if (this.#indexes.primaryKey.size >= this.opts.maxSize) {
			logger.warn('Storage full', { 
				currentSize: this.#indexes.primaryKey.size, 
				maxSize: this.opts.maxSize 
			})
			throw new Error(`Storage full: max size ${this.opts.maxSize} reached`)
		}
		
		this.commitEntry(primaryKey, entry)
		logger.debug('Entry saved to storage', { primaryKey })
	}

	/**
	 * Update existing entry in indexes
	 * @param {string} primaryKey - Primary key of entry to update
	 * @param {Object} entry - New entry data
	 * @throws {Error} If entry with primaryKey doesn't exist
	 */
	updateEntry(primaryKey, entry) {
		if (!this.#indexes.primaryKey.has(primaryKey)) {
			throw new Error(`Entry with key "${primaryKey}" not found`)
		}
		
		// Remove old indexes
		this.removeEntry(primaryKey)
		
		// Add with new data
		this.commitEntry(primaryKey, entry)
		logger.debug('Entry updated in storage', { primaryKey })
	}

	/**
	 * Save or update entry (upsert pattern)
	 * Creates new entry if it doesn't exist, updates if it does
	 * @param {string} primaryKey - Primary key for the entry
	 * @param {Object} entry - Entry data to save or update
	 */
	setEntry(primaryKey, entry) {
		if (this.#indexes.primaryKey.has(primaryKey)) {
			this.updateEntry(primaryKey, entry)
		} else {
			this.saveEntry(primaryKey, entry)
		}
	}

	/**
	 * Get aggregated entry from secondary index
	 * 
	 * This method handles the case where multiple entries share the same
	 * secondary index value (e.g., multiple files with same IMDB ID).
	 * It aggregates them by concatenating specified array properties.
	 * 
	 * Example: If two entries have itemId="local:tt123" and each has
	 * files=[file1] and files=[file2], the aggregated result will have
	 * files=[file1, file2].
	 * 
	 * @param {string} index - Secondary index name (e.g., 'itemId')
	 * @param {string} key - Value to look up (e.g., 'local:tt123')
	 * @param {Array<string>} groups - Properties to aggregate (e.g., ['files'])
	 * @returns {Object|null} - Aggregated entry or null if not found
	 */
	getAggrEntry(index, key, groups) {
		const items = this.#indexes[index]?.get(key)
		if (!items) return null
	
		let entry
		items.forEach(item => {
			// Copy the first entry, maintaining properties like {name, ih, sources}
			if (!entry) {
				entry = Object.assign({}, item)
				return
			}
			for (const group of groups) {
				if (typeof entry[group] === 'undefined') return
				if (!Array.isArray(entry[group])) {
					entry[group] = [entry[group]]
				}
				entry[group] = entry[group].concat(item[group])
			}
		})
	
		return entry
	}

	/**
	 * Remove entry from all indexes
	 * @param {string} primaryKey - Primary key of entry to remove
	 */
	removeEntry(primaryKey) {
		const entry = this.#indexes.primaryKey.get(primaryKey)
		if (!entry) {
			logger.debug('Entry not found for removal', { primaryKey })
			return
		}

		// Remove from primary index
		this.#indexes.primaryKey.delete(primaryKey)

		// Remove from secondary indexes
		this.opts.entryIndexes.forEach(property => {
			if (!entry[property]) return
			const secondaryIndex = this.#indexes[property].get(entry[property])
			if (secondaryIndex) {
				secondaryIndex.delete(primaryKey)
				// Clean up empty secondary index
				if (secondaryIndex.size === 0) {
					this.#indexes[property].delete(entry[property])
				}
			}
		})
		
		logger.debug('Entry removed from storage', { primaryKey })
	}

	/**
	 * Clear all indexes
	 */
	clear() {
		const size = this.#indexes.primaryKey.size
		this.#indexes.primaryKey.clear()
		this.opts.entryIndexes.forEach(key => {
			this.#indexes[key].clear()
		})
		logger.info('Storage cleared', { entriesRemoved: size })
	}

	/**
	 * Create storage indexes for an entry
	 * @private
	 * @param {string} key - Primary key
	 * @param {Object} entry - Entry data
	 */
	commitEntry(key, entry) {
		this.#indexes.primaryKey.set(key, entry)

		this.opts.entryIndexes.forEach(property => {
			if (!entry[property]) return
			if (!this.#indexes[property].has(entry[property])) {
				this.#indexes[property].set(entry[property], new Map())
			}
			this.#indexes[property].get(entry[property]).set(key, entry)
		})
	}
}

module.exports = Storage
