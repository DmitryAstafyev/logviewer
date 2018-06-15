'use strict';

const util          = require('util');
const ServiceClass  = require('../patterns/pattern.service');

const DEFAULT_TIMEOUT = 500; //ms
const DEFAULT_SIZE = 300000;//bytes

class StringTimerBuffer extends ServiceClass{

	constructor(length = DEFAULT_SIZE, timeout = DEFAULT_TIMEOUT){
		super({ signature: 'StringTimerBuffer'});
		this._length    = length;
		this._timeout   = timeout;
		this._timer     = -1;
		this._buffer    = '';
		this._onTimeout = this._onTimeout.bind(this);
		this.EVENTS     = {
			timer: 'timer'
		};
		if (typeof this._length !== 'number' || this._length <= 0) {
			throw new Error(this._logger.error(`For "length" expected number > 0, but get: ${util.inspect(length)}.`));
		}
		if (typeof this._timeout !== 'number' || this._timeout <= 0) {
			throw new Error(this._logger.error(`For "timeout" expected number > 0, but get: ${util.inspect(timeout)}.`));
		}
	}

	_clear(){
		this._buffer = '';
	}

	_drop(){
		if (this._timer !== -1) {
			clearTimeout(this._timer);
		}
	}

	_tick(){
		if (this._buffer.length >= this._length) {
			return this._onTimeout();
		}
		this._timer = setTimeout(this._onTimeout, this._timeout);
	}

	_onTimeout(){
		let buffer = this._buffer;
		this._clear();
		this.emit(this.EVENTS.timer, buffer);
	}

	add(str = '') {
		if (typeof str !== 'string') {
			return new Error(this._logger.error(`Expected string, but get: ${util.inspect(str)}.`));
		}
		this._drop();
		this._buffer += str;
		this._tick();
	}

	drop(){
		this._drop();
		this._clear();
	}
}

module.exports = StringTimerBuffer;