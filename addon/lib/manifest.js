const consts = require('./utils/consts')

const pkg = require('../package')

module.exports = {
	id: 'org.stremio.nas',
	version: pkg.version,
	description: pkg.description,

	name: 'NAS Media',

	// Properties that determine when Stremio picks this add-on
	resources: [
		'catalog',
		{ name: 'meta', types: ['movie', 'series', 'other'], idPrefixes: [consts.PREFIX_LOCAL] },
		{ name: 'stream', types: ['movie', 'series'], idPrefixes: [consts.PREFIX_IMDB] },
	],
	types: ['movie', 'series', 'other'],

	// @TODO: search?
	catalogs: [
		{ type: 'other', id: 'local' },
	]
}