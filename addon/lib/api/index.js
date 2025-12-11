const events = require('events')
const fetch = require('node-fetch')
const logger = require('../config/logger')

// API client for fetching files from Media API server
function createApiClient() {
	const ev = new events.EventEmitter()
	
	const apiUrl = process.env.MEDIA_API_URL || 'http://localhost:3000'
	
	setImmediate(async () => {
		const maxRetries = 10
		const retryDelay = 2000 // 2 seconds
		
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				logger.debug('Fetching files from API', { attempt, maxRetries, apiUrl })
				const response = await fetch(`${apiUrl}/files`)
				
				if (!response.ok) {
					throw new Error(`API request failed: ${response.status} ${response.statusText}`)
				}
				
				const files = await response.json()
				logger.info('Files fetched from API', { fileCount: files.length, apiUrl })
				
				// Emit 'file' event for each file
				// Store the full file object in a way that handlers can access it
				// We'll use the file path/name as the identifier
				for (const file of files) {
					// Emit with file object attached to event for handlers to use
					ev.emit('file', file)
				}
				
				ev.emit('finished')
				return // Success, exit retry loop
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
					apiUrl 
				})
				ev.emit('err', err)
				return // Give up after max retries or non-connection errors
			}
		}
	})
	
	return ev
}

module.exports = createApiClient

