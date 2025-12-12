const fetch = require('node-fetch')
const logger = require('../config/logger')
const config = require('../config')

/**
 * Media API client for fetching files from Media API server
 * @param {Object} options - Optional query parameters
 * @param {string} options.imdb_id - Optional IMDB ID to filter by
 * @returns {Promise<Array>} - Array of file objects
 */
async function fetchFiles(options = {}) {
	const apiUrl = config.apiInternalUrl
	const maxRetries = 10
	const retryDelay = 2000 // 2 seconds

	// Build query string
	const queryParams = new URLSearchParams()
	if (options.imdb_id) {
		queryParams.set('imdb_id', options.imdb_id)
	}
	const queryString = queryParams.toString()
	const url = `${apiUrl}/files${queryString ? '?' + queryString : ''}`

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			logger.debug('Fetching files from API', { 
				attempt, 
				maxRetries, 
				apiUrl,
				imdb_id: options.imdb_id || 'all'
			})
			const response = await fetch(url)

			if (!response.ok) {
				throw new Error(`API request failed: ${response.status} ${response.statusText}`)
			}

			const files = await response.json()
			logger.info('Files fetched from API', { 
				fileCount: files.length, 
				apiUrl,
				imdb_id: options.imdb_id || 'all'
			})
			return files
		} catch (err) {
			if (err.code === 'ECONNREFUSED' && attempt < maxRetries) {
				logger.debug('API not ready yet, retrying', { attempt, maxRetries, retryDelay, apiUrl })
				await new Promise(resolve => setTimeout(resolve, retryDelay))
				continue
			}
			logger.error('Error fetching files from API', {
				error: err.message,
				stack: err.stack,
				attempt,
				maxRetries,
				apiUrl,
				url
			})
			throw err
		}
	}
}

module.exports = fetchFiles

