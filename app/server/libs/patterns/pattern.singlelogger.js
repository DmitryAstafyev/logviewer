
const Logger = require('../tools/tools.logger');

const LoggerClass = (Super) => class extends Super {

	constructor( params = {}){
		super(params);
		this._logger = new Logger(typeof params.signature === 'string' ? params.signature : '');
	}

}

module.exports = LoggerClass;
