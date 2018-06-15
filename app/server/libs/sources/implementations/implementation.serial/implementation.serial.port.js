const ServiceClass 					= require('../../../patterns/pattern.service');
const SerialPortDefaultSettings 	= require('./implementation.serial.defaultsettings');
const StringTimerBuffer 			= require('../../../tools/tools.buffers');
const SerialPort  					= require('serialport');
const SetialPortWriter 				= require('./implementation.serial.writer');

const PORT_EVENTS = {
	open    : 'open',
	data    : 'data',
	error   : 'error',
	close 	: 'close'
};

module.exports = class Port extends ServiceClass {

	constructor(port, settings = SerialPortDefaultSettings){
		super({ signature: `Port: ${port}`});
		this._port         			= port;
		this._settings   			= settings;
		this._instance    			= null;
		this._ready       			= false;
		this._writer 				= null;
		this._buffer 				= new StringTimerBuffer();
		this._bufferWhileWriting 	= '';
		this.EVENTS 				= PORT_EVENTS;

		settings.autoOpen			= false;
		settings.lock       		= false;

		this._bindBuffer();
	}

	destroy(){
		return new Promise((resolve) => {
			this._unbindBuffer();
			if (!this._ready || this._instance === null) {
				return resolve;
			}
			if (this._writer !== null) {
				this._writer.stop(() => {
					this._destroyPortInstance();
					resolve();
				});
			} else {
				this._destroyPortInstance();
				resolve();
			}
		});
	}

	//////////////////////////////////////////////////////////
	// Buffer
	//////////////////////////////////////////////////////////
	_bindBuffer(){
		this._buffer.on(this._buffer.EVENTS.timer, this._onBuffer);
	}

	_unbindBuffer(){
		this._buffer.removeAllListeners(this._buffer.EVENTS.timer);
	}

	_onBuffer(str){
		if (this._writer.isBusy()) {
			this._bufferWhileWriting += str;
		} else {
			this.emit(PORT_EVENTS.data, this._port, this._bufferWhileWriting + str);
			this._bufferWhileWriting = '';
		}
	}

	//////////////////////////////////////////////////////////
	// Serial port
	//////////////////////////////////////////////////////////
	open(){
		return new Promise((resolve, reject) => {
			if (this._instance !== null) {
				return reject(new Error('Port is already opened.'));
			}
			this._instance = new SerialPort(this._port, this._settings);
			this._instance.open((error) => {
				if (error) {
					this._logger.debug(`Fail to open port due error: ${error.message}`);
					return reject(error);
				}
			});
			this._subscribePortInstance(resolve, reject);
		});
	}

	close(){
		return new Promise((resolve, reject) => {
			if (this._instance === null) {
				return reject(new Error('Port is not opened.'));
			}
			if (!this._ready){
				return reject(new Error('port is opened, but not initialized.'));
			}
			this._instance.close((error) => {
				this._destroyPortInstance();
				if (error) {
					this._logger.debug(`Port returns an error during closing: ${error.message}`);
					return reject(error);
				}
				resolve();
			});
		});
	}

	_destroyPortInstance(){
		this._ready = false;
		if (this._instance === null) {
			return;
		}
		this._unsubscribePortInstance();
		this._instance = null;
	}

	_subscribePortInstance(resolve, reject){
		this._instance.on(PORT_EVENTS.open, this['_on' + PORT_EVENTS.open].bind(this, resolve));
		this._instance.on(PORT_EVENTS.error, this['_on' + PORT_EVENTS.error].bind(this, reject));
		this._instance.on(PORT_EVENTS.data, this['_on' + PORT_EVENTS.data].bind(this));
		this._instance.on(PORT_EVENTS.close, this['_on' + PORT_EVENTS.close].bind(this));
	}

	_unsubscribePortInstance(){
		Object.keys(PORT_EVENTS).forEach((event)=>{
			this._instance.removeAllListeners(PORT_EVENTS[event]);
		});
	}

	['_on' + PORT_EVENTS.open](resolve){
		this._ready  = true;
		this._writer = new SetialPortWriter(this.instance, this.settings);
		this._logger.debug('port is opened');
		this.emit(PORT_EVENTS.open, this._port);
		return resolve();
	}

	['_on' + PORT_EVENTS.error](reject, error){
		if (!this._ready) {
			this._destroyPortInstance();
			return reject(error);
		}
		this._logger.debug(`port returns an error: ${error.message}`);
		this.emit(PORT_EVENTS.error, this._port, error);
	}

	['_on' + PORT_EVENTS.data](data){
		this._buffer.add(data.toString('utf8'));
	}

	['_on' + PORT_EVENTS.close](){
		this._logger.debug('port closed.');
		if (this._ready) {
			this.destroy().then(()=>{
				this.emit(PORT_EVENTS.close, this._port);
			});
		} else {
			this._destroyPortInstance();
			this.emit(PORT_EVENTS.close, this._port);
		}
	}

	//////////////////////////////////////////////////////////
	// Serial port writer
	//////////////////////////////////////////////////////////

	write(buffer = ''){
		return new Promise((resolve, reject) => {
			if (this._writer === null) {
				return reject(new Error('Port is not opened or not ready for writing.'));
			}
			this._writer.write(buffer)
				.then(resolve)
				.catch(reject);
		});
	}

};
