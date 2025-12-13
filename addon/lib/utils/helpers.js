const config = require('../config')

/**
 * Get the external stream URL for a file using file ID
 * @param {Object} file - File object with id (from Media API)
 * @returns {string} - Stream URL
 */
function getStreamUrl(file) {
	if (!file.id) {
		return ''
	}
	
	// Use centralized config for stream base URL
	const streamBaseUrl = config.streamBaseUrl
	
	// Handle Docker internal hostname - convert to external URL
	const externalUrl = streamBaseUrl.includes('stremio-nas-api:') ? 'http://localhost:3001' : streamBaseUrl
	
	return `${externalUrl}/api/stream/${file.id}`
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size (e.g., "3.57 GB", "974.35 MB")
 */
function formatFileSize(bytes) {
	if (!bytes || bytes === 0) return ''
	
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024))
	const size = (bytes / Math.pow(1024, unitIndex)).toFixed(2)
	
	return `${size} ${units[unitIndex]}`
}

/**
 * Build clean video title with metadata (for list display)
 * @param {Object} file - File object with metadata
 * @param {string} baseTitle - Base title (parsed name or filename)
 * @returns {string} - Formatted video title
 */
function buildVideoTitle(file, baseTitle) {
	const parts = []
	
	// Base title
	let title = baseTitle || file.name || 'Unknown'
	
	// Add resolution if available
	if (file.resolution) {
		title += ` ${file.resolution}`
	}
	
	// Add source if available
	if (file.source) {
		title += ` ${file.source}`
	}
	
	// Add video codec if available
	if (file.videoCodec) {
		title += ` ${file.videoCodec}`
	}
	
	// Add release group if available
	if (file.releaseGroup) {
		title += `-${file.releaseGroup}`
	}
	
	parts.push(title)
	
	// Second line: Resolution and size badges
	const metadataParts = []
	
	// Resolution badge
	if (file.resolution) {
		metadataParts.push(`📺 ${file.resolution}`)
	}
	
	// File size badge (check both length and size for compatibility)
	const fileSize = file.length || file.size
	if (fileSize) {
		const sizeStr = formatFileSize(fileSize)
		metadataParts.push(`💾 ${sizeStr}`)
	}
	
	if (metadataParts.length > 0) {
		parts.push(metadataParts.join(' '))
	}
	
	return parts.join('\n')
}

/**
 * Build enriched stream title with metadata (similar to Torrentio/TPB+ format)
 * @param {Object} file - File object with metadata
 * @param {string} baseTitle - Base title (parsed name or filename)
 * @returns {string} - Formatted stream title
 */
function buildStreamTitle(file, baseTitle) {
	const parts = []
	
	// First line: Base title with resolution and source if available
	let firstLine = baseTitle || file.name || 'Unknown'
	
	// Add resolution if available
	if (file.resolution) {
		firstLine += ` ${file.resolution}`
	}
	
	// Add source if available
	if (file.source) {
		firstLine += ` ${file.source}`
	}
	
	// Add video codec if available
	if (file.videoCodec) {
		firstLine += ` ${file.videoCodec}`
	}
	
	// Add release group if available
	if (file.releaseGroup) {
		firstLine += `-${file.releaseGroup}`
	}
	
	parts.push(firstLine)
	
	// Second line: Metadata with emojis
	const metadataParts = []
	
	// Resolution badge
	if (file.resolution) {
		metadataParts.push(`📺 ${file.resolution}`)
	}
	
	// Source badge
	if (file.source) {
		metadataParts.push(file.source)
	}
	
	// File size badge (check both length and size for compatibility)
	const fileSize = file.length || file.size
	if (fileSize) {
		const sizeStr = formatFileSize(fileSize)
		metadataParts.push(`💾 ${sizeStr}`)
	}
	
	if (metadataParts.length > 0) {
		parts.push(metadataParts.join(' '))
	}
	
	return parts.join('\n')
}

module.exports = {
	getStreamUrl,
	formatFileSize,
	buildVideoTitle,
	buildStreamTitle
}

