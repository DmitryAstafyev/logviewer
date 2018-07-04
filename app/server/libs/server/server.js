const ServiceClass = require('../patterns/pattern.service');
const HTTP = require('http');
const NET = require('net');
const SETTINGS = require('../config.js');
const QueryString = require('querystring');
const Processor = require('server.api.requests');

const METHODS = {
	POST    : 'POST',
	GET     : 'GET'
};

const REQUEST_EVENTS = {
	data    : 'data',
	end     : 'end'
};

const TARGET_POST_URLS = {
	API : '/api'
};

class ServerService extends ServiceClass {

	constructor() {
		super({ signature: 'Server' });
		this._port = SETTINGS.HTTP_PORT;
		this._server = null;
	}

	//////////////////////////////////////////////////////////
	// Port availability check
	//////////////////////////////////////////////////////////
	_isPortFree(port){
		return new Promise((resolve, reject) => {
			const server = NET.createServer().listen(port);
			server.on('listening', () => {
				server.close();
				resolve(port);
			});
			server.on('error', () => {
				reject();
			});
		});
	}

	_findFreePort(defaultPort) {
		return new Promise((resolve) => {
			this._isPortFree(defaultPort)
				.then((port) => {
					this._logger.verbose(`Port ${port} is free. Will use this port to create server.`);
					resolve(port);
				})
				.catch(() => {
					const nextPort = parseInt(defaultPort, 10) + 1;
					this._logger.verbose(`Port ${defaultPort} is busy. Will try ${nextPort}`);
					return this._findFreePort(nextPort);
				});
		});
	}

	//////////////////////////////////////////////////////////
	// Create server
	//////////////////////////////////////////////////////////
	create(){
		return new Promise((resolve, reject) => {
			this._findFreePort(this._port)
				.then((port) => {
					this._port = port;
					this._server = HTTP.createServer(this._onServerRequest.bind(this));
					this.server.listen(this._port);
					this._logger.debug(`Server is created. Start listening http://127.0.0.1:${this._port}`);
					resolve();
				})
				.catch((error) => {
					this._logger.error(`Cannot start a server due error: ${error.message}`);
					reject(error);
				});
		});
	}

	//////////////////////////////////////////////////////////
	// Server processor
	//////////////////////////////////////////////////////////
	_allowAnyOrigin(response){
		response.setHeader('Access-Control-Allow-Origin',   '*');
		response.setHeader('Access-Control-Request-Method', '*');
		response.setHeader('Access-Control-Allow-Methods',  'GET, POST');
		response.setHeader('Access-Control-Allow-Headers',  '*');
	}

	_onServerRequest(request, response){
		this.allowAnyOrigin(response);
		if (request.method !== METHODS.POST) {
			return this._sendResponse(
				response,
				this._getFailMessage(this._logger.verbose(`Client sends "${request.method}" request, which doesn't supported.`))
			);
		}
		if (request.url.toLowerCase() !== TARGET_POST_URLS.API) {
			return this._sendResponse(
				response,
				this._getFailMessage(this._logger.verbose(`Requested URL isn't supported: ${request.url}.`))
			);
		}
		this._getPOSTData(request)
			.then((data) => {
				Processor.proceed(data)
					.then((results) => {
						return this._sendResponse(
							response,
							this._getSuccessMessage(results)
						);
					})
					.catch((error) => {
						return this._sendResponse(
							response,
							this._getFailMessage(this._logger.warning(`Fail proceed request due error: ${error.message}.`))
						);
					});
			})
			.catch((error) => {
				return this._sendResponse(
					response,
					this._getFailMessage(this._logger.warning(`Cannot get request's data due error: ${error.message}.`))
				);
			});
	}

	_getPOSTData(request){
		return new Promise((resolve, reject) => {
			let str = '';
			const unsubscribe = () => {
				request.removeAllListeners(REQUEST_EVENTS.data);
				request.removeAllListeners(REQUEST_EVENTS.end);
			};
			request.on(REQUEST_EVENTS.data, (data)=>{
				str += data;
				if (str.length > SETTINGS.MAX_POST_LENGTH) {
					unsubscribe();
					reject(new Error(this._logger.warning(`Cannot proceed a request, because it's too big. Limitation is: ${SETTINGS.MAX_POST_LENGTH}.`)));
				}
			});
			request.on(REQUEST_EVENTS.end, ()=>{
				unsubscribe();
				resolve(QueryString.parse(str));
			});
		});
	}

	_sendResponse(response, str){
		response.writeHead(200, {'Content-Type': 'text/plain'});
		response.end(str);
	}

	_getSuccessMessage(message){
		return JSON.stringify({
			result: message
		});
	}

	_getFailMessage(message){
		return JSON.stringify({
			error: message
		});
	}
}

module.exports = ServerService;