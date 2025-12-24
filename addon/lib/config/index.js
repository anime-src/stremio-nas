/**
 * Central configuration for the Stremio NAS Addon
 * All environment variables are managed here
 */

module.exports = {
	// API Configuration
	// URL for addon to connect to API server (can be Docker service name or external URL)
	// Also used as base URL for stream URLs that Stremio will use to play videos
	apiUrl: process.env.API_URL || 'http://localhost:3000',
	
	// API Key for authentication (optional - required if server has API_KEY configured)
	apiKey: process.env.API_KEY || null,
	
	// Server Configuration
	port: parseInt(process.env.PORT, 10) || 1222,
	
	// Polling Configuration
	pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES, 10) || 5,
	enablePolling: process.env.ENABLE_POLLING !== 'false',
	
	// Indexing Configuration
	maxIndexed: parseInt(process.env.MAX_INDEXED, 10) || 10000,
	
	// Logging Configuration
	logLevel: process.env.LOG_LEVEL || 'debug'
}

