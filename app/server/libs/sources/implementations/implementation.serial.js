const SourceClass = require('../../patterns/pattern.source');

const SourceImplementationMethods = require('../source.interface.desc').SourceImplementationMethods;
//const SourceImplementationEvents = require('../source.interface.desc').SourceImplementationEvents;

const Port = require('./implementation.serial/implementation.serial.port');


module.exports = class Source extends SourceClass {

	constructor(){
		super({ signature: 'Source: serial'});
		this._ports = {};
	}

	//////////////////////////////////////////////////////////
	// Public part (obligatory methods)
	//////////////////////////////////////////////////////////
	[SourceImplementationMethods.open](params){
		return new Promise((resolve, reject) => {
			if (typeof params !== 'object' || params === null) {
				return reject(new Error('Have been gotten not valid parameters for [open] method'));
			}
			if (typeof params.port !== 'string' || params.port.trim() !== null) {
				return reject(new Error('Not valid parameters for [open] method. No [port] property found.'));
			}
			if (this._ports[params.port] !== void 0) {
				//Port is already opened
				return resolve();
			}
			params.settings = typeof params.setting === 'object' ? (params.settings !== null ? params.settings : undefined) : undefined;
			const port = new Port(params.port, params.settings);
			port.open()
				.then(() => {
					this._ports[params.port] = port;
					this._subscribePortEvents(port, params.port);
					resolve();
				})
				.catch((e)=>{
					this._logger.debug(`Fail to open port (${params.port}) due error: ${e.message}.`);
					reject();
					return Promise.reject();
				});
		});
	}

	[SourceImplementationMethods.close](){
	}

	[SourceImplementationMethods.send](){
	}

	[SourceImplementationMethods.getInfo](){
	}

	//////////////////////////////////////////////////////////
	// Port events
	//////////////////////////////////////////////////////////
	_subscribePortEvents(port, portId){
		port.subscribe(port.EVENTS.open, this._onPortOpened.bind(portId));
		port.subscribe(port.EVENTS.data, this._onPortData.bind(portId));
		port.subscribe(port.EVENTS.error, this._onPortError.bind(portId));
		port.subscribe(port.EVENTS.close, this._onPortClose.bind(portId));
	}

	_unsubscribePortEvents(port){
		port.unsubscribe(port.EVENTS.open);
		port.unsubscribe(port.EVENTS.data);
		port.unsubscribe(port.EVENTS.error);
		port.unsubscribe(port.EVENTS.close);
	}

	_onPortOpened(portId){

	}

	_onPortData(portId){

	}

	_onPortError(portId){

	}

	_onPortClose(portId){

	}

	//////////////////////////////////////////////////////////
	// Private part (methods of implementation by itself)
	//////////////////////////////////////////////////////////

};