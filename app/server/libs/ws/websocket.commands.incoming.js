const LoggerClass = require('../patterns/pattern.singlelogger');
const SingleEmitterClass = require('../patterns/pattern.singleemitter');
const Commands = require('./websocket.commands.storage');

const DEFAULT_COMMANDS = {
	greeting 			: 'greeting',
	WriteToSerial	: 'WriteToSerial',
	WriteToTelnet	: 'WriteToTelnet'
};

class Processor extends LoggerClass {

	constructor() {
		super({ signature: 'WebSocketIncomeMessages' });
		this._commands = new Commands({
			signature: 'IncomingCommandsStorage',
			defaults: DEFAULT_COMMANDS
		});
		//Init commands subscription managers
		this._commands.getAll().forEach((command) => {
			this[command] = new SingleEmitterClass();
		});
	}

	_validate(message){
		if (typeof message !== 'object' || message === null) {
			return false;
		}
		if (message.GUID === void 0) {
			return false;
		}
		if (typeof message.command !== 'string') {
			return false;
		}
		if (message.params === void 0) {
			return false;
		}
		return true;
	}

	_parse(message){
		if (typeof message === 'string') {
			try {
				message = JSON.parse(message);
			} catch (e) {
				message = null;
			}
		}
		return message;
	}

	proceed(message){
		message = this._parse(message);
		if (!this._validate(message)) {
			return new Error(this._logger.warning(`[${message.GUID}]: Received message with wrong format: ${JSON.stringify(message)}.`));
		}
		if (this[message.command] === void 0) {
			return new Error(this._logger.warning(`[${message.GUID}]: Next command does not support: ${message.command}.`));
		}
		this[message.command].emit(message.GUID, message.params);
		return true;
	}

	registerCommand(command){
		const error = this._commands.register(command);
		if (error instanceof Error) {
			return error;
		}
		this[command] = new SingleEmitterClass();
	}

}

module.exports = (new Processor());