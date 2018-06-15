const EventEmitter = require('events');
const LoggerClass = require('./pattern.logger');

class ServiceClass extends LoggerClass(EventEmitter) {

	constructor(params){
		super(params);
	}

}

module.exports = ServiceClass;
