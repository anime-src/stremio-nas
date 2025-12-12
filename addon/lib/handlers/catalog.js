const consts = require('../utils/consts')

function catalogHandler(indexManager, args) {
	const metas = []

	// Get all itemIds from index manager
	const itemIds = indexManager.getAllItemIds()
	
	itemIds.forEach(function([itemId]) {
		const entry = indexManager.getEntryByItemId(itemId)
		if (!(entry.itemId && entry.files && entry.files.length))
			return

		const firstFile = entry.files[0]
		
		// Try to get meta from storage first, fallback to simple meta
		const meta = indexManager.getMeta(entry.itemId)
		// Use file type (movie/series) instead of 'other' so Stremio requests streams
		const fileType = firstFile.type || 'movie'
		const fallbackType = (fileType === 'movie' || fileType === 'series') ? fileType : 'movie'
		metas.push(meta || {
			id: entry.itemId,
			type: fallbackType, // Use movie/series instead of 'other' so streams are requested
			name: firstFile.parsedName || entry.name,
			poster: firstFile.imdb_id ? consts.METAHUB_URL+'/poster/medium/'+firstFile.imdb_id+'/img' : null,
		})
	})

	return Promise.resolve({ metas: metas })
}

module.exports = catalogHandler