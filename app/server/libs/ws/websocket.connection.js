const ServiceClass = require('../patterns/pattern.service');
const incomeMessageProcessor = require('websocket.commands.incoming');
const outgoingMessageProcessor = require('websocket.commands.outgoing');

const CONNECTION_EVENTS  = {
	message : 'message',
	close   : 'close',
	error   : 'error'
};

const MESSAGE_TYPES = {
	utf8    : 'utf8',
	binary  : 'binary',
};

class Connection extends ServiceClass {

	constructor(guid, connection) {
		super({ signature: `Connection ${guid}@${connection.remoteAddress}`});
		this._guid = guid;
		this._connection = connection;
		this.EVENTS = CONNECTION_EVENTS;
		this._bind();
		this._subscribe();
		this._greeting();
	}

	_bind(){
		this._onMessage = this._onMessage.bind(this);
		this._onError = this._onError.bind(this);
		this._onClose = this._onClose.bind(this);
	}

	_subscribe(){
		this._connection.on(CONNECTION_EVENTS.message, this._onMessage);
		this._connection.on(CONNECTION_EVENTS.error, this._onError);
		this._connection.on(CONNECTION_EVENTS.close, this._onClose);
	}

	_unsubscribe(){
		this._connection.removeAllListeners(CONNECTION_EVENTS.message);
		this._connection.removeAllListeners(CONNECTION_EVENTS.error);
		this._connection.removeAllListeners(CONNECTION_EVENTS.close);
	}

	_greeting(){
		outgoingMessageProcessor.send(this._connection, this._guid, 'greeting', {});
	}

	_onMessage(message){
		if (message.type === MESSAGE_TYPES.utf8) {
			this._logger.verbose(`Received message: ${message.utf8Data}`);
			const error = incomeMessageProcessor.process(message.utf8Data);
			if (error instanceof Error) {
				return this._logger.warning(`Error during receiving message: ${error.message}`);
			}
			this.emit(this.EVENTS.message, this, message.utf8Data);
		} else if (message.type === MESSAGE_TYPES.binary) {
			this._logger.verbose(`Received binary message: ${message.binaryData.length} bytes`);
		}
	}

	_onError(error){
		this._logger.warning('Error on connection.');
		this.emit(this.EVENTS.error, this, error);
	}

	_onClose(reason, description){
		this._logger.warning(`Connection is closed due reason: ${reason} (${description}).`);
		this.destroy(false);
		this.emit(this.EVENTS.close, this);
	}

	destroy(tryCloseConnection = true){
		this._unsubscribe();
		if (tryCloseConnection){
			try {
				this._connection.close();
			} catch (error) {
				this._logger.warning(`Error while closing connection: ${error.message}`);
			}
		}
	}

	setGUID(guid){
		this._guid = guid;
		outgoingMessageProcessor.send(this._connection, this._guid, 'GUIDAccepted', {});
	}

	getGUID(){
		return this._guid;
	}

	send(command, params){
		outgoingMessageProcessor.send(this._connection, this._guid, command, params);
	}

}

module.exports = Connection;