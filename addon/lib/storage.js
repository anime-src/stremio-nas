/**
 * In-memory storage with indexing capabilities
 * No file persistence - data is rebuilt from API on each startup
 */
class Storage {
	constructor(opts = {}) {
		this.opts = {
			entryIndexes: [],
			validateRecord: null,
			...opts
		}
		
		this.indexes = {
			primaryKey: new Map()
		}

		// Create indexes for specified entry properties
		this.opts.entryIndexes.forEach(key => {
			this.indexes[key] = new Map()
		})
	}

	/**
	 * Load from disk (no-op for in-memory storage)
	 * Kept for API compatibility but does nothing
	 * @param {string} dbPath - Database path (ignored)
	 * @returns {Promise<void>}
	 */
	load(dbPath) {
		// In-memory storage doesn't persist, so this is a no-op
		return Promise.resolve()
	}

	/**
	 * Save entry to indexes (no file persistence)
	 * @param {string} primaryKey - Primary key for the entry
	 * @param {Object} entry - Entry data to index
	 * @param {Function} cb - Callback function
	 */
	saveEntry(primaryKey, entry, cb) {
		if (this.indexes.primaryKey.has(primaryKey)) {
			return cb()
		}
		this.commitEntry(primaryKey, entry)
		cb()
	}

	/**
	 * Get aggregated entry from index
	 * @param {string} index - Index name to query
	 * @param {string} key - Key to look up
	 * @param {Array<string>} groups - Properties to aggregate
	 * @returns {Object|null} Aggregated entry or null if not found
	 */
	getAggrEntry(index, key, groups) {
		const items = this.indexes[index]?.get(key)
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
	 * Create storage indexes for an entry
	 * @private
	 * @param {string} key - Primary key
	 * @param {Object} entry - Entry data
	 */
	commitEntry(key, entry) {
		this.indexes.primaryKey.set(key, entry)

		this.opts.entryIndexes.forEach(property => {
			if (!entry[property]) return
			if (!this.indexes[property].has(entry[property])) {
				this.indexes[property].set(entry[property], new Map())
			}
			this.indexes[property].get(entry[property]).set(key, entry)
		})
	}
}

module.exports = Storage
