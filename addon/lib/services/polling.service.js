const logger = require('../config/logger')

/**
 * Polling Service
 * Manages periodic API polling for file updates
 */
class PollingService {
	constructor(config, fetchFilesFn, indexManager) {
		this.config = config
		this.fetchFiles = fetchFilesFn
		this.indexManager = indexManager
		this.intervalId = null
		this.isRunning = false
		this.lastFiles = new Map() // Map<fileId, fileData>
	}

	/**
	 * Start polling service
	 * Performs initial fetch then schedules periodic polling
	 */
	async start() {
		if (this.isRunning) {
			logger.warn('Polling service already running')
			return
		}

		logger.info('Starting polling service', {
			enabled: this.config.enablePolling,
			intervalMinutes: this.config.pollIntervalMinutes
		})

		// Initial fetch
		await this._performFetch('initial')

		// Schedule periodic polling if enabled
		if (this.config.enablePolling) {
			const intervalMs = this.config.pollIntervalMinutes * 60 * 1000
			this.intervalId = setInterval(() => {
				this._performFetch('periodic').catch((err) => {
					logger.error('Polling fetch failed', { error: err.message })
				})
			}, intervalMs)
			
			this.isRunning = true
			logger.info('Polling scheduled', { intervalMinutes: this.config.pollIntervalMinutes })
		}
	}

	/**
	 * Stop polling service
	 */
	stop() {
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
			this.isRunning = false
			logger.info('Polling service stopped')
		}
	}

	/**
	 * Force immediate refresh
	 */
	async forceRefresh() {
		logger.info('Force refresh requested')
		return await this._performFetch('manual')
	}

	/**
	 * Perform a fetch operation
	 * @private
	 */
	async _performFetch(type) {
		const startTime = Date.now()
		logger.debug('Starting file fetch', { type })

		try {
			const files = await this.fetchFiles(this.config.apiInternalUrl)
			const duration = Date.now() - startTime
			
			logger.info('Files fetched from API', { 
				fileCount: files.length, 
				type,
				duration: `${duration}ms`
			})

			// Process files
			const changes = this._detectChanges(files)
			this._applyChanges(changes)

			// Update last known state
			this.lastFiles.clear()
			files.forEach(file => {
				this.lastFiles.set(file.id, file)
			})

			return changes
		} catch (err) {
			logger.error('Error fetching files from API', { 
				error: err.message,
				type,
				apiUrl: this.config.apiInternalUrl
			})
			throw err
		}
	}

	/**
	 * Detect changes between old and new file lists
	 * @private
	 * @returns {Object} - { added: [], removed: [], updated: [] }
	 */
	_detectChanges(newFiles) {
		const changes = {
			added: [],
			removed: [],
			updated: []
		}

		// Create map of new files for efficient lookup
		const newFilesMap = new Map()
		newFiles.forEach(file => {
			newFilesMap.set(file.id, file)
		})

		// Detect added and updated files
		newFiles.forEach(file => {
			if (!this.lastFiles.has(file.id)) {
				changes.added.push(file)
			} else {
				// Check if file was modified (compare mtime or size)
				const oldFile = this.lastFiles.get(file.id)
				if (this._fileChanged(oldFile, file)) {
					changes.updated.push(file)
				}
			}
		})

		// Detect removed files
		this.lastFiles.forEach((file, fileId) => {
			if (!newFilesMap.has(fileId)) {
				changes.removed.push(fileId)
			}
		})

		return changes
	}

	/**
	 * Check if file has changed
	 * @private
	 */
	_fileChanged(oldFile, newFile) {
		// Compare mtime or size to detect changes
		return oldFile.mtime !== newFile.mtime || oldFile.size !== newFile.size
	}

	/**
	 * Apply detected changes to index
	 * @private
	 */
	_applyChanges(changes) {
		let indexedCount = 0

		// Remove deleted files
		changes.removed.forEach(fileId => {
			this.indexManager.removeFile(fileId)
		})

		// Update modified files
		changes.updated.forEach(file => {
			if (this.indexManager.updateFile(file)) {
				indexedCount++
			}
		})

		// Add new files
		changes.added.forEach(file => {
			if (this.indexManager.addFile(file)) {
				indexedCount++
			}
		})

		if (changes.added.length > 0 || changes.removed.length > 0 || changes.updated.length > 0) {
			logger.info('Index updated', {
				added: changes.added.length,
				removed: changes.removed.length,
				updated: changes.updated.length,
				indexed: indexedCount
			})
		}

		const stats = this.indexManager.getStats()
		logger.debug('Index stats', stats)
	}
}

module.exports = PollingService

