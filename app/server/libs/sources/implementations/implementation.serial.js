const SourceClass = require('../../patterns/pattern.source');
const SourceDescriptionClass = require('../../patterns/pattern.source.description');
const SerialPort = require('serialport');

const util = require('util');

const SourceImplementationMethods = require('../source.interface.desc').SourceImplementationMethods;
const SourceImplementationEvents = require('../source.interface.desc').SourceImplementationEvents;

const SourceExtraMethods = {
	getPortsList: 'getPortsList',
	scanPorts: 'scanPorts',
	stopScanPorts: 'stopScanPorts'
};

const Port = require('./implementation.serial/implementation.serial.port');

const SOURCE_TYPE = 'serial';
const SCAN_PORT_DURATION = 5000;//ms

class Source extends SourceClass {

	constructor(){
		super({ signature: 'Source: serial'});
		this._ports = {};
		this._users = {};
		this._scanPortsTimer = -1;
	}

	//////////////////////////////////////////////////////////
	// Public part (obligatory methods)
	//////////////////////////////////////////////////////////
	[SourceImplementationMethods.open](user, params){
		return new Promise((resolve, reject) => {
			if (typeof user !== 'string' || user.trim() === '') {
				return reject(new Error(`To open source (port) should be defined [user], but was gotten: ${util.instpect(user)}`));
			}
			if (typeof params !== 'object' || params === null) {
				return reject(new Error('Have been gotten not valid parameters for [open] method'));
			}
			if (typeof params.port !== 'string' || params.port.trim() === '') {
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
					this._addUserToPort(user, params.port);
					this._onPortOpened(params.port);
					resolve();
				})
				.catch((e)=>{
					this._logger.debug(`Fail to open port (${params.port}) due error: ${e.message}.`);
					this._unsubscribePortEvents(port);
					reject();
				});
		});
	}

	[SourceImplementationMethods.close](user, port){
		return new Promise((resolve, reject) => {
			if (typeof user !== 'string' || user.trim() === '') {
				return reject(new Error(`To close source (port) should be defined [user], but was gotten: ${util.instpect(user)}`));
			}
			if (typeof port !== 'string' && port.trim() === '') {
				return reject(new Error(`To close a port, port should be defined as not empty {string}, but was gotten: ${util.inspect(port)}`));
			}
			if (this._ports[port] === void 0) {
				//Port is already closed
				return resolve();
			}
			this._removeUserFromPort(user, port);
			if (this._isPortUsed(port)){
				//Port is still used by someone. Do not close it.
				return resolve();
			}
			this._ports[port].close()
				.then(() => {
					this._destroyPortReference(port);
					this._onPortClose(port, [user]);
					resolve();
				})
				.catch((e)=>{
					this._logger.debug(`Fail to close port (${port}) due error: ${e.message}.`);
					this._destroyPortReference(port);
					reject(e);
				});
		});
	}

	[SourceImplementationMethods.send](port, str){
		return new Promise((resolve, reject) => {
			if (typeof port !== 'string' && port.trim() === '') {
				return reject(new Error(`To write into port, port should be defined as not empty {string}, but was gotten: ${util.inspect(port)}`));
			}
			if (this._ports[port] === void 0) {
				return reject(new Error(`Cannot write to a port, because port ${port} isn't opened.`));
			}
			if (typeof str !== 'string' && str.trim() === ''){
				return reject(new Error(`Cannot write to a port, because buffer isn't a string or it's empty string: ${util.inspect(str)}`));
			}
			this._ports[port].write(str)
				.then(resolve)
				.catch((e) => {
					this._logger.debug(`Fail to write to port (${port}) due error: ${e.message}.`);
					reject(e);
				});
		});
	}

	[SourceImplementationMethods.getType](){
		return SOURCE_TYPE;
	}

	[SourceImplementationMethods.getUsers](port){
		if (typeof port === 'string' && port.trim() !== '') {
			return this._getUsersOfPort(port);
		}
		return this._getAllUsers();
	}

	//////////////////////////////////////////////////////////
	// Public part (extra methods)
	//////////////////////////////////////////////////////////
	[SourceExtraMethods.getPortsList](){
		return new Promise((resolve, reject) =>{
			SerialPort.list((error, ports) => {
				if (error) {
					this._logger.debug(`Cannot get list of ports due error: ${error.message}.`);
					return reject(error);
				}
				this._logger.verbose('List of ports was requested:');
				ports.forEach((port) => {
					this._logger.verbose(
						'comName: '         + (typeof port.comName      === 'string' ? port.comName       : (typeof port.comName      === 'number' ? port.comName       : '[no data]')) +
						'; pnpId: '         + (typeof port.pnpId        === 'string' ? port.pnpId         : (typeof port.pnpId        === 'number' ? port.pnpId         : '[no data]')) +
						'; manufacturer: '  + (typeof port.manufacturer === 'string' ? port.manufacturer  : (typeof port.manufacturer === 'number' ? port.manufacturer  : '[no data]')));
				});
				resolve(ports);
			});
		});
	}

	[SourceExtraMethods.scanPorts](user){
		return Promise((resolve, reject) => {
			if (typeof user !== 'string' || user.trim() === '') {
				return reject(new Error(`To scan ports should be defined [user], but was gotten: ${util.instpect(user)}`));
			}
			this[SourceExtraMethods.getPortsList]()
				.then((ports) => {
					const promises = ports.map((info) => {
						return this[SourceImplementationMethods.open](user, { port: info.comName });
					});
					Promise.all(promises)
						.then(() => {
							this._autostopScanPorts(user);
							resolve(ports);
						})
						.catch((e)=>{
							this._logger.debug(`Cannot open all ports due error: ${e.message}.`);
							this._autostopScanPorts(user);
							//Resolve in any case
							resolve(ports);
						});
				})
				.catch(reject);
		});
	}

	[SourceExtraMethods.stopScanPorts](user){
		return Promise((resolve, reject) => {
			if (typeof user !== 'string' || user.trim() === '') {
				return reject(new Error(`To stop scan ports should be defined [user], but was gotten: ${util.instpect(user)}`));
			}
			const promises = Object.keys(this._ports).map((port) => {
				return this[SourceImplementationMethods.close](user, port);
			});
			Promise.all(promises)
				.then(() => {
					resolve();
				})
				.catch((e)=>{
					this._logger.debug(`Cannot close all ports due error: ${e.message}.`);
					//Resolve in any case
					resolve();
				});
		});
	}

	//////////////////////////////////////////////////////////
	// Port events
	//////////////////////////////////////////////////////////
	_subscribePortEvents(port, portId){
		port.subscribe(port.EVENTS.open, this._onPortOpened.bind(this, portId));
		port.subscribe(port.EVENTS.data, this._onPortData.bind(this, portId));
		port.subscribe(port.EVENTS.error, this._onPortError.bind(this, portId));
		port.subscribe(port.EVENTS.close, this._onPortClose.bind(this, portId));
	}

	_unsubscribePortEvents(port){
		port.unsubscribe(port.EVENTS.open);
		port.unsubscribe(port.EVENTS.data);
		port.unsubscribe(port.EVENTS.error);
		port.unsubscribe(port.EVENTS.close);
	}

	_onPortOpened(port){
		this.emit(SourceImplementationEvents.opened, new SourceDescriptionClass(SOURCE_TYPE, port, this._users[port]));
	}

	_onPortData(port, str){
		this.emit(SourceImplementationEvents.data, new SourceDescriptionClass(SOURCE_TYPE, port, this._users[port]), str);
	}

	_onPortError(port, error){
		this.emit(SourceImplementationEvents.error, new SourceDescriptionClass(SOURCE_TYPE, port, this._users[port]), error);
	}

	_onPortClose(port, users){
		users = users instanceof Array ? users : this._users[port];
		this.emit(SourceImplementationEvents.closed, new SourceDescriptionClass(SOURCE_TYPE, port, users));
	}

	//////////////////////////////////////////////////////////
	// Private part (methods of implementation by itself)
	//////////////////////////////////////////////////////////
	_destroyPortReference(port){
		this._unsubscribePortEvents(this._ports[port]);
		this._ports[port] = null;
		delete this._ports[port];
	}

	//////////////////////////////////////////////////////////
	// Private part (port's usage)
	//////////////////////////////////////////////////////////
	_addUserToPort(user, port){
		if (this._users[port] === void 0) {
			this._users[port] = [];
		}
		if (this._users[port].indexOf(user) === -1){
			this._users[port].push(user);
			return true;
		}
		return false;
	}

	_removeUserFromPort(user, port){
		if (this._users[port] === void 0) {
			return false;
		}
		if (this._users[port].indexOf(user) !== -1){
			this._users[port].splice(this._users[port].indexOf(user), 1);
			if (this._users[port].length === 0 ){
				delete this._users[port];
			}
			return true;
		}
		return false;
	}

	_isPortUsed(port){
		return this._users[port] !== void 0 ? true : false;
	}

	_getUsersOfPort(port){
		return this._users[port] !== void 0 ? this._users[port].slice() : 0;
	}

	_getAllUsers(){
		let users = [];
		Object.keys(this._users).forEach((port) => {
			this._users[port].forEach((user) => {
				if (users.indexOf(user) === -1) {
					users.push(user);
				}
			});
		});
		return users;
	}

	//////////////////////////////////////////////////////////
	// Private part (scanning ports)
	//////////////////////////////////////////////////////////
	_autostopScanPorts(user){
		this._scanPortsTimer = setTimeout(() => {
			this[SourceExtraMethods.stopScanPorts](user);
		}, SCAN_PORT_DURATION);
	}
}

module.exports = {
	Source: Source,
	type: SOURCE_TYPE,
	SourceExtraMethods: SourceExtraMethods
};