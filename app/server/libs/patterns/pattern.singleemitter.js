const GUID = require('uuid/v1');
const SIGNATURE = '__singleEmitterSignature';

class SingleEmitterClass {

	constructor(){
		this.__handlers = [];
	}

	subscribe(handler){
		if (typeof handler !== 'function') {
			return new Error(`Fail to subscribe, because as handler expected {function}, but was gotten: {${typeof handler}}`);
		}
		if (typeof handler[SIGNATURE] === 'string' && handler[SIGNATURE] !== '') {
			return new Error('Fail to subscribe, because handler is already subscribed.');
		}
		handler[SIGNATURE] = GUID();
		this.__handlers.push(handler);
		//Return unsubscription function
		return this.unsubscribe.bind(this.handler);
	}

	unsubscribe(handler = null){
		if (typeof handler !== 'function') {
			handler = null;
		}
		if (handler === null) {
			this.__handlers = [];
		} else {
			if (typeof handler[SIGNATURE] !== 'string') {
				return false;
			}
			this.__handlers = this.__handlers.filter((_handler) => {
				return _handler[SIGNATURE] !== handler[SIGNATURE];
			});
		}
		return true;
	}

	emit(...args){
		this.__handlers.forEach((handler) => {
			handler(...args);
		});
	}

}

module.exports = SingleEmitterClass;
