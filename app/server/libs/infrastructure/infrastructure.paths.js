const Path = require('path');
const OS = require('os');
const FileSystem = require('../tools/tools.fs');
const JASMINE_PATH = '/node_modules/jasmine/bin';

class PathsSettings {

	constructor(){
		this.ROOT                           = Path.resolve(OS.homedir() + '/logviewer');
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
		let root = Path.dirname(require.main.filename);
		//Check for jasmine path (if it's started in scope of tests)
		if (root.indexOf(JASMINE_PATH) !== -1) {
			root = root.replace(JASMINE_PATH, '');
		}
		return Path.join(root, folder);
	}

}

module.exports = (new PathsSettings());
