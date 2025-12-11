const mapEntryToMeta = require('../utils/mapEntryToMeta')
const consts = require('../utils/consts')
const { getStreamUrl, buildVideoTitle, buildStreamTitle } = require('../utils/helpers')
const logger = require('../config/logger')

function metaHandler(storage, metaStorage, args) {
	let entry = storage.getAggrEntry('itemId', args.id, ['files'])
	if(!entry) {
		return Promise.resolve({ meta: null });
	}
	return Promise.resolve(entry)
	.then(function(entry) {
		if (!entry.files || entry.files.length === 0) {
			return Promise.resolve({ meta: null })
		}
		
		const uxTime = new Date().getTime()
		const videos = entry.files.sort(function(a, b) {
			// If we have season and episode, sort videos; otherwise retain the order
			try {
				return a.season - b.season || a.episode - b.episode;
			} catch(e) {}
			return 0;
		}).map(function(file, index) {
			return mapFile(entry, uxTime, file, index, args.id)
		})

		return Promise.resolve(metaStorage.indexes.primaryKey.get(entry.itemId))
		.then(function(meta) {
			return meta || mapEntryToMeta(entry)
		})
		.then(function(meta) {
			meta.videos = videos
			return Promise.resolve({ meta: meta })
		});
	})
	.catch(function(err) {
		logger.error('Error in meta handler', { error: err.message, stack: err.stack, itemId: args.id })
		return Promise.resolve({ meta: null })
	})
}

function mapFile(entry, uxTime, file, index, itemId) {
	const streamUrl = getStreamUrl(file)
	const baseTitle = file.parsedName || entry.name || file.name || 'Unknown'
	const streamTitle = buildStreamTitle(file, baseTitle)
	
	const stream = {
		title: streamTitle,  // Enhanced title with metadata
		url: streamUrl || '',  // Constructed from file.id
		subtitle: consts.STREAM_LOCALFILE_SUBTITLE,
	}
	
	// Add behaviorHints similar to Torrentio (for better grouping)
	if (file.resolution || file.source || file.videoCodec || file.releaseGroup) {
		const bingeParts = ['stremio-nas']
		if (file.resolution) bingeParts.push(file.resolution.toLowerCase())
		if (file.source) bingeParts.push(file.source)
		if (file.videoCodec) bingeParts.push(file.videoCodec.toLowerCase())
		if (file.releaseGroup) bingeParts.push(file.releaseGroup.toLowerCase())
		
		stream.behaviorHints = {
			bingeGroup: bingeParts.join('|'),
			filename: file.name || baseTitle
		}
	}
	
	// Add tag for resolution (like TPB+)
	if (file.resolution) {
		stream.tag = file.resolution
	}
	
	// Use IMDB ID for video ID (matching original addon - all entries have IMDB IDs)
	const videoId = [file.imdb_id, file.season, file.episode].filter(x => x).join(':')
	
	const thumbnail = file.season && file.episode && file.imdb_id
			? `${consts.METAHUB_EPISODES_URL}/${file.imdb_id}/${file.season}/${file.episode}/w780.jpg`
			: (file.imdb_id ? `${consts.METAHUB_URL}/background/medium/${file.imdb_id}/img` : null)
	const videoTitle = buildVideoTitle(file, baseTitle)
	
	return {
		id: videoId || stream.title,
		// We used to have a thumbnail here.
		// This caused downloading of all episodes in order to be generated a preview.
		title: videoTitle,  // Enhanced title with metadata
		publishedAt: entry.dateModified || new Date(),
		// The videos in the UI are sorted by release date. Newest at top.
		// For local files we want oldest at top
		released: new Date(uxTime - index * 60000),
		stream: stream,
		season: file.season,
		episode: file.episode,
		thumbnail: thumbnail
	}
}

module.exports = metaHandler