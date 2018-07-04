const ServiceClass = require('../patterns/pattern.service');
const WebSocketServer = require('websocket').server;
const Connection = require('websocket.connection');
const GUID = require('uuid/v1');

const WS_SERVER_SETTINGS = {
	PROTOCOL : 'logviewer'
};

const WS_SERVER_EVENTS = {
	request : 'request',
	error   : 'error'
};

class WebSocketService extends ServiceClass {

	constructor(httpServer){
		super({ signature: 'WebSocketService' });
		this._httpServer = httpServer;
		this._bindServerHandlers();
		this._bindConnectionHandlers();
		this._logger.debug('Starting webSocket server.');
		this._wsServer = new WebSocketServer({
			httpServer              : this.httpServer,
			autoAcceptConnections   : false
		});
		this._logger.debug('WebSocket server is started.');
		this._subscribeWSServer();
		this._connections = {};
		this.EVENTS = {
			disconnect: 'disconnect',
			connected: 'connected',
			error: 'error'
		};
	}

	//////////////////////////////////////////////////////////
	// WS events
	//////////////////////////////////////////////////////////
	_bindServerHandlers(){
		this._onWSRequest	= this._onWSRequest.bind(this);
		this._onWSError	= this._onWSError.bind(this);
	}

	_subscribeWSServer(){
		this.wsServer.on(WS_SERVER_EVENTS.request, this._onWSRequest);
		this.wsServer.on(WS_SERVER_EVENTS.error, this._onWSError);
	}

	_unsubscribeWSServer(){
		this.wsServer.removeAllListeners(WS_SERVER_EVENTS.request);
		this.wsServer.removeAllListeners(WS_SERVER_EVENTS.error);
	}

	_onWSRequest(request){
		if (!this._isOriginAllowed(request.origin)){
			this._logger.verbose(`Refuse connection from origin: ${request.origin}.`);
			return request.reject();
		}
		if (!this._isProtocolValid(request)){
			this._logger.verbose(`Connection is rejected. Next protocols aren't supported: ${request.requestedProtocols.join(', ')}`);
			return request.reject();
		}
		this._addConnection(request);
	}

	_onWSError(error){
		this._logger.verbose(`Error of connection: ${error.message}.`);
	}

	_isOriginAllowed(/*origin*/){
		return true;
	}

	_isProtocolValid(request){
		return request.requestedProtocols instanceof Array ? (request.requestedProtocols.indexOf(WS_SERVER_SETTINGS.PROTOCOL) !== -1) : false;
	}

	//////////////////////////////////////////////////////////
	// Connection events
	//////////////////////////////////////////////////////////
	_bindConnectionHandlers(){
		this._onConnectionError	= this._onConnectionError.bind(this);
		this._onConnectionClose	= this._onConnectionClose.bind(this);
	}

	_subscribeConnection(connection){
		connection.on(connection.EVENTS.error, this._onConnectionError);
		connection.on(connection.EVENTS.close, this._onConnectionClose);
	}

	_unsubscribeConnection(connection){
		connection.removeAllListeners(connection.EVENTS.error);
		connection.removeAllListeners(connection.EVENTS.close);
	}

	_onConnectionError(connection/*, error*/){
		const guid = connection.getGUID();
		this.emit(this.EVENTS.error, guid);
	}

	_onConnectionClose(connection){
		const guid = connection.getGUID();
		this._removeConnection(guid);
		this.emit(this.EVENTS.disconnect, guid);
	}

	//////////////////////////////////////////////////////////
	// Sending
	//////////////////////////////////////////////////////////
	send(guid, command, params){
		if (typeof guid !== 'string' || guid.trim() === '') {
			return new Error(this._logger.warning('Expecting guid will be not empty string'));
		}
		if (typeof command !== 'string' || command.trim() === '') {
			return new Error(this._logger.warning('Expecting command will be not empty string'));
		}
		Object.keys(this._connections).forEach((guid) => {
			const connection = this._connections[guid];
			if (guid === '*') {
				return connection.send(command, params);
			}
			if (guid === connection.getGUID()){
				return connection.send(command, params);
			}
		});
	}

	//////////////////////////////////////////////////////////
	// Connections
	//////////////////////////////////////////////////////////
	_addConnection(request){
		const guid = GUID();
		const connection = request.accept(WS_SERVER_SETTINGS.PROTOCOL, request.origin);
		this._connections[guid] = new Connection(guid, connection);
		this._subscribeConnection(this._connections[guid]);
		this._logger.verbose(`Connection "${guid}" from origin: ${request.origin} is accepted.`);
	}

	_removeConnection(guid){
		if (this._connections[guid] === void 0) {
			return this._logger.warning(`Attempt to remove not existing connection "${guid}".`);
		}
		this._unsubscribeConnection(this._connections[guid]);
		this._connections[guid].destroy();
		delete this._connections[guid];
	}
}

module.exports = WebSocketService;
