'use strict';

const FileSystem = require('../tools/tools.fs');
const SourceImplementationMethods = require('./source.interface.desc').SourceImplementationMethods;
const ServiceClass = require('../patterns/pattern.service');
const Path = require('path');

module.exports = class SourcesLoader extends ServiceClass {

	constructor(path){
		super( { signature: 'SourcesLoader'} );
		this._path = path;
		this._filesystem = new FileSystem();
	}

	getAll(){
		return new Promise((resolve, reject) => {
			this._filesystem.getListOfFiles(this._path)
				.then((list) => {
					const sources = [];
					try {
						list.forEach((module) => {
							const Implementation = require(Path.join(this._path, module));
							if (!this._isImplementationValid(Implementation)) {
								throw new Error(`Module ${module} doesn't return constructor as it's expected.`);
							}
							const instance = new (Implementation)();
							const error = this._getValidationErrors(instance);
							if (error instanceof Error) {
								throw new Error(`Module ${module} error: ${error.message}.`);
							}
							sources.push(instance);
						});
						resolve(sources);
					} catch (error) {
						reject(error);
					}
				})
				.catch((error) => {
					reject(error);
				});

		});
	}

	_isImplementationValid(module){
		return typeof module === 'function';
	}

	_getValidationErrors(instance){
		let result = true;
		Object.keys(SourceImplementationMethods).forEach((method) => {
			if (result && typeof instance[SourceImplementationMethods[method]] !== 'function') {
				result = new Error(`Obligatory method "${method}" isn't found.`);
			}
		});
		return result;
	}
};