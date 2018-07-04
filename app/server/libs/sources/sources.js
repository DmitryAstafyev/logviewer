const SourcesLoader = require('./sources.loader');
const ServiceClass = require('../patterns/pattern.service');
const PathsSettings = require('../infrastructure/infrastructure.paths');

const DEFAULT_PATH = PathsSettings.getInternalPathTo('libs/sources/implementations');

module.exports = class Sources extends ServiceClass {

	constructor(path){
		super({ signature: 'SourcesController' });
		this._path = typeof path === 'string' ? path : DEFAULT_PATH;
		this._sources = [];
	}

	init(){
		return this._load();
	}

	_load(){
		return new Promise((resolve, reject) => {
			const loader = new SourcesLoader(this._path);
			loader.getAll()
				.then((sources) => {
					this._sources = sources;
					resolve(sources);
				})
				.catch((error) => {
					this._logger.error(`Cannot initialize sources due error: ${error.message}.`);
					reject(error);
				});
		});
	}
};