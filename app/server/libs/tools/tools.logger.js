'use strict';

/* eslint-disable no-console */
const Paths = require('../infrastructure/infrastructure.paths');
const FileSystem = require('./tools.fs');
const util = require('util');

const LOG_TYPES = {
	log: 'log',
	warn: 'warn',
	debug: 'debug',
	info: 'info',
	error: 'error',
	verbose: 'verbose'
};

//We need it for third-party applications/libs
const REDIRECTED_LOG_TYPES = {
	silly: 'silly',
	warning: 'warning'
};

class Console {

	_log(method, smth) {
		if (console[method] !== void 0) {
			console[method](smth);
		} else {
			console.log(smth);
		}
		return smth;
	}

	[LOG_TYPES.log](smth){
		return this._log(LOG_TYPES.log, smth);
	}

	[LOG_TYPES.warn](smth){
		return this._log(LOG_TYPES.warn, smth);
	}

	[LOG_TYPES.debug](smth){
		return this._log(LOG_TYPES.debug, smth);
	}

	[LOG_TYPES.info](smth){
		return this._log(LOG_TYPES.info, smth);
	}

	[LOG_TYPES.error](smth){
		return this._log(LOG_TYPES.error, smth);
	}

	[LOG_TYPES.verbose](smth){
		return this._log(LOG_TYPES.verbose, smth);
	}

}

const FSLogWriterBufferTimeout = 5000; //ms

class FSLogsWriter {

	constructor(){
		this._console = new Console();
		this._filesystem = new FileSystem();
		this._logFile = Paths.LOGVIEWER_LOGS;
		this._FSReady = false;
		this._buffer = '';
		this._bufferTimer = -1;
		this._initFSStorage();
	}

	_initFSStorage(){
		this._filesystem.isFileExist(this._logFile)
			.then((status) => {
				if (!status) {
					return this._filesystem.writeStringToFile('', this._logFile)
						.then(()=>{
							this._FSReady = true;
						})
						.catch((error)=>{
							this._console.error(`Cannot initialize log's file fue error: ${error.message}`);
						});
				}
				this._FSReady = true;
			})
			.catch((error) => {
				this._console.error(`Cannot initialize log's file fue error: ${error.message}`);
			});
	}

	_write(message){
		if (!this._FSReady) {
			return;
		}
		this._filesystem.appendStringToFile(message, this._logFile)
			.catch((error) => {
				this._console.error(`Cannot initialize log's file fue error: ${error.message}`);
				this._FSReady = false;
			});
	}

	_next(){
		if (this._buffer !== '') {
			this._buffer = '';
			this._write(this._buffer);
		}
		this._bufferTimer = setTimeout(this._next, FSLogWriterBufferTimeout);
	}

	write(message) {
		if (typeof message !== 'string' || message === '') {
			return;
		}
		this._buffer += message;
	}

}

const fsLogsWriter = new FSLogsWriter();

module.exports = class Logger {

	constructor(signature){
		this._signature = signature;
		this._console = new Console();
	}

	[LOG_TYPES.log](smth){
		const message = this._getMessage(smth, LOG_TYPES.log);
		fsLogsWriter._write(message);
		return this._console[LOG_TYPES.log](smth);
	}

	[LOG_TYPES.warn](smth){
		const message = this._getMessage(smth, LOG_TYPES.warn);
		fsLogsWriter._write(message);
		return this._console[LOG_TYPES.warn](smth);
	}

	[LOG_TYPES.debug](smth){
		const message = this._getMessage(smth, LOG_TYPES.debug);
		fsLogsWriter._write(message);
		return this._console[LOG_TYPES.debug](smth);
	}

	[LOG_TYPES.info](smth){
		const message = this._getMessage(smth, LOG_TYPES.info);
		fsLogsWriter._write(message);
		return this._console[LOG_TYPES.info](smth);
	}

	[LOG_TYPES.error](smth){
		const message = this._getMessage(smth, LOG_TYPES.error);
		fsLogsWriter._write(message);
		return this._console[LOG_TYPES.error](smth);
	}

	[LOG_TYPES.verbose](smth){
		const message = this._getMessage(smth, LOG_TYPES.verbose);
		fsLogsWriter._write(message);
		return this._console[LOG_TYPES.verbose](smth);
	}

	//Redirections
	[REDIRECTED_LOG_TYPES.silly](smth){
		return this[LOG_TYPES.info](smth);
	}

	[REDIRECTED_LOG_TYPES.warning](smth){
		return this[LOG_TYPES.warn](smth);
	}

	_getMessage(message, level){
		if (typeof message !== 'string') {
			const messageType = (typeof message);
			try {
				message = util.inspect(message);
			} catch (e) {
				message = 'cannot parse message';
			}
			message = `<${messageType}> ${message}`;
		}
		return `[${this._getTimeMark()}][${this._signature}][${level}]: ${message}`;
	}

	_getTimeMark(){
		function fill(src, count) {
			return (src + '').length < count ? ('0'.repeat(count - (src + '').length) + src) : (src + '');
		}
		let date = new Date();
		return `${fill(date.getMonth() + 1, 2)}.${fill(date.getDate(), 2)} ${fill(date.getHours(), 2)}:${fill(date.getMinutes(), 2)}:${fill(date.getSeconds(), 2)}.${fill(date.getMilliseconds(), 3)}`;
	}

};