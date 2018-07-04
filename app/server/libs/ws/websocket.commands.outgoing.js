const LoggerClass = require('../patterns/pattern.singlelogger');
const Commands = require('./websocket.commands.storage');

const DEFAULT_COMMANDS = {
	greeting                : 'greeting',
	GUIDAccepted            : 'GUIDAccepted',
	SerialData              : 'SerialData',
	SerialScanResults       : 'SerialScanResults',
	SerialScanFinished      : 'SerialScanFinished',
	TelnetData              : 'TelnetData',
	TelnetClosed            : 'TelnetClosed',
	WriteToSerial           : 'WriteToSerial',
	WriteToTelnet           : 'WriteToTelnet',
	ResultWrittenToSerial   : 'ResultWrittenToSerial',
	ResultWrittenToTelnet   : 'ResultWrittenToTelnet',
	UpdateIsAvailable       : 'UpdateIsAvailable',
	UpdateIsNotAvailable    : 'UpdateIsNotAvailable',
	UpdateDownloadProgress  : 'UpdateDownloadProgress',
	ADBLogcatData           : 'ADBLogcatData',
	TermProcessData         : 'TermProcessData',
	TermProcessClosed       : 'TermProcessClosed',
	CallMenuItem            : 'CallMenuItem',
	DesktopModeNotification : 'DesktopModeNotification'
};

class Processor extends LoggerClass {

	constructor() {
		super({ signature: 'WebSocketOutgoingMessages' });
		this._commands = new Commands({
			signature: 'OutgoingCommandsStorage',
			defaults: DEFAULT_COMMANDS
		});
	}

	send(connection, clientGUID, command, params){
		if (typeof connection === 'undefined' || connection === null || typeof connection.sendUTF !== 'function') {
			return new Error(this._logger.warning('Cannot send command, because connection isn\'t defined properly.'));
		}
		if (typeof clientGUID !== 'string') {
			return new Error(this._logger.warning('Cannot send command, because clientGUID isn\'t defined properly.'));
		}
		if (typeof command !== 'string') {
			return new Error(this._logger.warning('Cannot send command, because command isn\'t defined properly.'));
		}
		if (!this._commands.isValid(command)) {
			return new Error(this._logger.warning(`Unsupported command is defined: ${command}.`));
		}
		if (typeof params === 'object' || params !== null && this._hasParamsFunctions(params)) {
			return new Error(this._logger.warning('Cannot send command, because params has functions. It should be pure object.'));
		}
		try {
			connection.sendUTF(JSON.stringify({
				GUID    : clientGUID,
				command : command,
				params  : params
			}));
		} catch (error) {
			this._logger.warning(`Error during sending command: ${error.message}`);
			return error;
		}
		return true;
	}

	_hasParamsFunctions(params){
		let result = false;
		if (typeof params === 'object' || params !== null) {
			Object.keys(params).forEach((key) => {
				if (result) {
					return;
				}
				if (typeof params[key] === 'function') {
					result = true;
					return;
				}
				if (params[key] === void 0 || params[key] === null) {
					return;
				}
				if (typeof params[key].forEach === 'function') {
					params[key].forEach((param) => {
						if (result) {
							return;
						}
						result = this._hasParamsFunctions(param);
					});
					return;
				}
				result = this._hasParamsFunctions(params[key]);
			});
		}
		return result;
	}

	registerCommand(command){
		const error = this._commands.register(command);
		if (error instanceof Error) {
			return error;
		}
	}

}

module.exports = (new Processor());