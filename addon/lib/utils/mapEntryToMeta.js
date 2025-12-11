const fetch = require('node-fetch')
const consts = require('./consts')
const logger = require('../config/logger')

async function mapEntryToMeta(entry) {

	// We assume that one torrent may have only one IMDB ID for now: this is the only way to a decent UX now
	const imdbIdFile = entry.files.find(function(f) { return f.imdb_id })
	const biggestFileWithName = entry.files.sort((a, b) => b.length - a.length).find(f => f.parsedName);
	// Use the file type (movie/series) instead of 'other' so Stremio requests streams
	const fileType = biggestFileWithName ? biggestFileWithName.type : (entry.files[0] ? entry.files[0].type : 'movie')
	const metaType = (fileType === 'movie' || fileType === 'series') ? fileType : 'movie'
	
	const genericMeta = {
		id: entry.itemId,
		type: metaType, // Use movie/series instead of 'other' so streams are requested
		name: (biggestFileWithName && biggestFileWithName.parsedName) || entry.name,
		showAsVideos: true,
	}

	if (!imdbIdFile) {
		logger.debug('No IMDB ID found, using generic meta', { itemId: entry.itemId, name: genericMeta.name })
		return genericMeta
	}

	// If we have IMDB ID, first we can fill in those, then try to get the actual object from cinemeta
	genericMeta.poster = consts.METAHUB_URL+'/poster/medium/'+imdbIdFile.imdb_id+'/img' 
	genericMeta.background = consts.METAHUB_URL+'/background/medium/'+imdbIdFile.imdb_id+'/img' 
	genericMeta.logo = consts.METAHUB_URL+'/logo/medium/'+imdbIdFile.imdb_id+'/img' 

	const cinemetaUrl = consts.CINEMETA_URL+'/meta/'+imdbIdFile.type+'/'+imdbIdFile.imdb_id+'.json'
	logger.debug('Fetching metadata from Cinemeta', { 
		url: cinemetaUrl, 
		imdb_id: imdbIdFile.imdb_id, 
		type: imdbIdFile.type,
		parsedName: biggestFileWithName?.parsedName || entry.name
	})

	try {
		const resp = await fetch(cinemetaUrl)
		
		if (!resp.ok) {
			throw new Error(`Cinemeta API returned ${resp.status} ${resp.statusText}`)
		}
		
		const data = await resp.json()
		
		if (!(data && data.meta)) {
			logger.warn('No meta found in Cinemeta response', { imdb_id: imdbIdFile.imdb_id, response: data })
			throw 'no meta found'
		}
		
		// Log what we got from Cinemeta before filtering
		logger.debug('Received metadata from Cinemeta', { 
			imdb_id: imdbIdFile.imdb_id,
			name: data.meta.name,
			type: data.meta.type,
			originalTitle: data.meta.originalTitle,
			allFields: Object.keys(data.meta)
		})
		
		// Preserve type field before filtering
		const cinemetaType = data.meta.type
		const interestingFields = [
			'imdb_id', 'name', 'genre', 'director', 'cast', 'poster', 'description', 'trailers', 'background', 'logo', 'imdbRating', 'runtime', 'genres', 'releaseInfo', 'type'
		];
		Object.keys(data.meta).forEach(key => interestingFields.includes(key) || delete data.meta[key])
		
		// Merge Media API metadata from entry when Cinemeta fields are null/empty
		// Use entry data as fallback for fields that Cinemeta doesn't provide or provides as null/empty
		if (!data.meta.name && imdbIdFile.imdbName) {
			data.meta.name = imdbIdFile.imdbName
		}
		
		// Cast/starring: Cinemeta uses 'cast' array, Media API has 'starring' string
		if ((!data.meta.cast || data.meta.cast.length === 0) && imdbIdFile.starring) {
			// Convert starring string to cast array format if needed
			data.meta.cast = imdbIdFile.starring.split(',').map(s => s.trim()).filter(s => s)
		}
		
		// ReleaseInfo: Cinemeta uses 'releaseInfo', Media API has 'imdbYear'
		if (!data.meta.releaseInfo && imdbIdFile.imdbYear) {
			data.meta.releaseInfo = imdbIdFile.imdbYear.toString()
		}
		
		// Use the type from Cinemeta if it's movie/series, otherwise use the file type
		// This ensures Stremio requests streams for the correct type
		const finalType = (cinemetaType === 'movie' || cinemetaType === 'series') ? cinemetaType : genericMeta.type
		Object.assign(data.meta, {
			id: genericMeta.id,
			type: finalType, // Use Cinemeta type if valid, otherwise file type (movie/series)
		})
		
		logger.debug('Metadata processed and assigned', { 
			imdb_id: imdbIdFile.imdb_id,
			finalName: data.meta.name,
			finalType: data.meta.type
		})
		
		return data.meta
	} catch (err) {
		// NOTE: not fatal, we can just fallback to genericMeta
		logger.warn('Failed to fetch metadata from Cinemeta, using generic meta', { 
			imdb_id: imdbIdFile?.imdb_id, 
			error: err.message || err,
			fallbackName: genericMeta.name
		})

		return genericMeta
	}
}

module.exports = mapEntryToMeta
