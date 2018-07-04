const EventEmitter = require('events');
const Util = require('util');
const LoggerClass = require('./pattern.logger');

class ServiceClass extends LoggerClass(EventEmitter) {

	constructor(params){
		super(params);
	}

	subscribe(event, handler){
		if (typeof event !== 'string' || event.trim() === '') {
			return new Error(`Fail to subscribe, because event "${Util.inspect(event)}" should be not empty string.`);
		}
		if (typeof handler !== 'function') {
			return new Error(`Fail to subscribe, because as handler expected {function}, but was gotten: {${typeof handler}}`);
		}
		this.addListener(event, handler);
		return true;
	}

	unsubscribe(event, handler = null){
		if (typeof event !== 'string' || event.trim() === '') {
			return new Error(`Fail to unsubscribe, because event "${Util.inspect(event)}" should be not empty string.`);
		}
		if (typeof handler !== 'function') {
			handler = null;
		}
		if (handler === null) {
			this.removeAllListeners(event);
		} else {
			this.removeListener(event, handler);
		}
		return true;
	}

}

module.exports = ServiceClass;
