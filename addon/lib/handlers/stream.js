const consts = require('../utils/consts')
const { getStreamUrl, buildStreamTitle } = require('../utils/helpers')

const SUPPORTED_TYPES = ['movie', 'series']

function streamHandler(storage, args) {
	if (!SUPPORTED_TYPES.includes(args.type)) {
		return Promise.resolve({ streams: [] })
	}

	const streams = []

	// Handle IMDB-based entries (tt prefix) - video ID is like "tt123456" or "tt123456:1:2"
	// Matching original addon behavior - only handle IMDB-based requests
	if (args.id.startsWith(consts.PREFIX_IMDB)) {
		const idSplit = args.id.split(':')
		const itemIdLocal = consts.PREFIX_LOCAL + idSplit[0]

		if (storage.indexes.itemId.has(itemIdLocal)) {
			const entries = storage.indexes.itemId.get(itemIdLocal)
			for (var entry of entries.values()) {
				const f = entry.files[0]
				const fileVideoId = getFileVideoId(f)
				// Match video ID and type (both should be 'movie' or 'series')
				const typeMatches = args.type === f.type
				
				if (typeMatches && args.id === fileVideoId) {
					// Construct stream URL from file ID
					const streamUrl = getStreamUrl(f)
					const baseTitle = f.parsedName || entry.name || f.name || 'Unknown'
					const streamTitle = buildStreamTitle(f, baseTitle)
					
					if (streamUrl) {
						const stream = {
							id: streamUrl,
							url: streamUrl,
							subtitle: consts.STREAM_LOCALFILE_SUBTITLE,
							title: streamTitle,
						}
						
						// Add behaviorHints similar to Torrentio (for better grouping)
						if (f.resolution || f.source || f.videoCodec || f.releaseGroup) {
							const bingeParts = ['stremio-nas']
							if (f.resolution) bingeParts.push(f.resolution.toLowerCase())
							if (f.source) bingeParts.push(f.source)
							if (f.videoCodec) bingeParts.push(f.videoCodec.toLowerCase())
							if (f.releaseGroup) bingeParts.push(f.releaseGroup.toLowerCase())
							
							stream.behaviorHints = {
								bingeGroup: bingeParts.join('|'),
								filename: f.name || baseTitle
							}
						}
						
						// Add tag for resolution (like TPB+)
						if (f.resolution) {
							stream.tag = f.resolution
						}
						
						streams.push(stream)
					}
				}
			}
		}
	}

	return Promise.resolve({ streams: streams })
}

function getFileVideoId(f) {
	const segments = (f.season && f.episode) ?
		[f.imdb_id, f.season, f.episode]
		: [f.imdb_id]
	return segments.join(':')
}

module.exports = streamHandler