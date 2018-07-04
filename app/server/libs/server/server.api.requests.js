const LoggerClass = require('../patterns/pattern.singlelogger');

class Processor extends LoggerClass {

	constructor() {
		super({ signature: 'ServerIncomeCommandsProcessor' });
		this._handlers = {};
	}

	_validate(request){
		if (typeof request !== 'object' || request === null) {
			return new Error('Cannot parse request\'s object due error: data isn\'t an object.');
		}
		const errors = [];
		const types = [{ guid: 'string', params: 'object', command: 'string'}];
		types.forEach((prop) => {
			if (typeof request[prop] !== types[prop]){
				errors.push(`Expected propery "${prop}" would be {${types[prop]}.`);
			}
		});
		if (errors.length > 0) {
			return new Error(`Error during parsing request's data: ${errors.join('; ')}`);
		}
	}

	proceed(request){
		return new Promise((resolve, reject) => {
			const error = this._validate(request);
			if (error instanceof Error) {
				return reject(error);
			}
			if (this._handlers[request.command] === void 0) {
				return reject(new Error(`Not supportable command: ${request.command}.`));
			}
			this._handlers[request.command](request.guid, request.params, resolve, reject);
		});
	}

	registerHandler(command, handler){
		if (this._handlers[command] !== void 0) {
			return new Error(`Handler is already registered for command: ${command}.`);
		}
		if (typeof handler !== 'function') {
			return new Error(`Expecting handler will be a function. But handler is: ${typeof handler}.`);
		}
		this._handlers[command] = handler;
	}

}

module.exports = (new Processor());