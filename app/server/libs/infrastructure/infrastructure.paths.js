'use strict';

const Path = require('path');
const FileSystem = require('../tools/tools.fs');

class PathsSettings {

	constructor(){
		this.os                             = require('os');
		this.ROOT                           = Path.resolve(this.os.homedir() + '/logviewer');
		this.LOGVIEWER_LOGS                 = Path.resolve(this.ROOT + '/logviewer.log');
		this.SETTINGS_FILE                  = Path.resolve(this.ROOT + '/logs/settings.json');
		this.LOGS_ROOT                      = Path.resolve(this.ROOT + '/logs/');
		this.LOGS_FOLDER                    = Path.resolve(this.ROOT + '/logs/files/');
		this.REGISTER_FILE                  = Path.resolve(this.ROOT + '/logs/register.json');
		this.DOWNLOADS                      = Path.resolve(this.ROOT + '/downloads/');
		this.initialize();
	}

	initialize(){
		const filesystem = new FileSystem();
		[this.ROOT, this.LOGS_ROOT, this.LOGS_FOLDER, this.DOWNLOADS].forEach((folder) => {
			filesystem.createFolder(folder).catch(()=>{ });
		});
	}

	getInternalPathTo(folder){
		const root = Path.dirname(require.main.filename);
		return Path.join(root, folder);
	}

}

module.exports = (new PathsSettings());
