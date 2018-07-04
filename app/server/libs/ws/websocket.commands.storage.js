const LoggerClass = require('../patterns/pattern.singlelogger');

class Commands extends LoggerClass{

	constructor(params) {
		super(params);
		this._commands = Object.assign({}, params.defaults);
	}

	register(command){
		if (typeof command !== 'string') {
			return new Error(this._logger.warning('Command should be a string.'));
		}
		if (this._commands[command] !== void 0) {
			return new Error(this._logger.warning(`Command "${command}" is already registered.`));
		}
		this._commands[command] = command;
	}

	isValid(command){
		if (typeof command !== 'string') {
			return false;
		}
		if (this._commands[command] === void 0) {
			return false;
		}
		return true;
	}

	getAll(){
		return Object.keys(this._commands).map((key) => {
			return this._commands[key];
		});
	}

}

module.exports = Commands;