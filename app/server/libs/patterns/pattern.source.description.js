class SourceDescriptionClass {

	constructor(type, name = '', users = [], params = {}){
		this.type = type;
		this.name = name;
		this.users = users instanceof Array ? users.slice() : [];
		this.params = params;
	}

}

module.exports = SourceDescriptionClass;