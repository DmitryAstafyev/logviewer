const EventEmitter 					= require('events');
const LoggerClass 					= require('./pattern.logger');
const SourceImplementationMethods 	= require('../sources/source.interface.desc').SourceImplementationMethods;
const SourceImplementationEvents 	= require('../sources/source.interface.desc').SourceImplementationEvents;

class SourceClass extends LoggerClass(EventEmitter) {

	constructor(params){
		super(params);
	}

	[SourceImplementationMethods.subscribe](event, handler){
		if (typeof event !== 'string' || SourceImplementationEvents[event] === void 0) {
			return new Error(`Fail to subscribe, because event "${event}" isn't supported.`);
		}
		if (typeof handler !== 'function') {
			return new Error(`Fail to subscribe, because as handler expected {function}, but was gotten: {${typeof handler}}`);
		}
		this.addListener(event, handler);
		return true;
	}

	[SourceImplementationMethods.unsubscribe](event, handler = null){
		if (typeof event !== 'string' || SourceImplementationEvents[event] === void 0) {
			return new Error(`Fail to unsubscribe, because event "${event}" isn't supported.`);
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

module.exports = SourceClass;
