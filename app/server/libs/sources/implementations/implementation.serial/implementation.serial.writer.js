const ServiceClass = require('../../../patterns/pattern.service');
const PromiseTasks = require('../../../tools/tools.promisetasks');

module.exports = class PortWriter extends ServiceClass {

	constructor(instance, settings = {}, symbolsPerPackage = 1){
		super({ signature: 'port writer'});
		this._instance	= instance;
		this._size    	= symbolsPerPackage;
		this._settings	= {
			vtransmit: typeof settings === 'object' ? (settings !== null ? (typeof settings.vtransmit === 'number' ? settings.vtransmit : 50) : 50) : 50
		};
		this._tasks		= new PromiseTasks();
	}

	write(buffer){
		return new Promise((resolve, reject) => {
			if (typeof buffer === 'string') {
				return reject(new Error(`Expecting buffer will be not empty {string}. But was gotten; ${typeof buffer}`));
			}
			buffer = buffer.replace(/\r?\n|\r/gi, '');
			this._tasks.add(function () {
				return new Promise((_resolve, _reject) => {
					this._proceed(buffer, _resolve, _reject);
				}).then(() => {
					resolve();
				}).catch((e)=>{
					reject(e);
				});
			}.bind(this, buffer, resolve, reject));
		});

	}

	destroy(){
		return new Promise((resolve)=>{
			this._tasks.stop().then(resolve);
		});
	}

	isBusy(){
		return this._tasks.isBusy();
	}

	_proceed(buffer, resolve, reject) {
		if (buffer.length === 0) {
			return resolve();
		}
		const bufferIn    = buffer.substr(0,this.size);
		const bufferOut   = buffer.substr(this.size, buffer.length);
		setTimeout(()=>{
			this._write(bufferIn + (bufferOut === '' ? '\n\r' : ''))
				.then(()=>{
					this._next(bufferOut, resolve, reject);
				})
				.catch((e)=>{
					reject(e);
				});
		}, this.settings.vtransmit);
	}

	_write(buffer){
		return new Promise((resolve, reject) => {
			this._instance.write(buffer, (error)=>{
				if (error) {
					return reject(error);
				}
				this.instance.drain(()=>{
					resolve();
				});
			});
		});
	}


}