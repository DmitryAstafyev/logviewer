const FS = require('fs');
const Path = require('path');

const ERRORS = {
	/* jshint ignore:start */
	EACCES			: 'EACCES',			// (Permission denied): An attempt was made to access a file in a way forbidden by its file access permissions.
	EADDRINUSE		: 'EADDRINUSE',		// (Address already in use): An attempt to bind a server (net, http, or https) to a local address failed due to another server on the local system already occupying that address.
	ECONNREFUSED	: 'ECONNREFUSED',	// (Connection refused): No connection could be made because the target machine actively refused it. This usually results from trying to connect to a service that is inactive on the foreign host.
	ECONNRESET		: 'ECONNRESET',		// (Connection reset by peer): A connection was forcibly closed by a peer. This normally results from a loss of the connection on the remote socket due to a timeout or reboot. Commonly encountered via the http and net modules.
	EEXIST			: 'EEXIST',			// (File exists): An existing file was the target of an operation that required that the target not exist.
	EISDIR			: 'EISDIR',			// (Is a directory): An operation expected a file, but the given pathname was a directory.
	EMFILE			: 'EMFILE',			// (Too many open files in system): Maximum number of file descriptors allowable on the system has been reached, and requests for another descriptor cannot be fulfilled until at least one has been closed. This is encountered when opening many files at once in parallel, especially on systems (in particular, macOS) where there is a low file descriptor limit for processes. To remedy a low limit, run ulimit -n 2048 in the same shell that will run the Node.js process.
	ENOENT			: 'ENOENT',			// (No such file or directory): Commonly raised by fs operations to indicate that a component of the specified pathname does not exist — no entity (file or directory) could be found by the given path.
	ENOTDIR			: 'ENOTDIR',		// (Not a directory): A component of the given pathname existed, but was not a directory as expected. Commonly raised by fs.readdir.
	ENOTEMPTY		: 'ENOTEMPTY',		// (Directory not empty): A directory with entries was the target of an operation that requires an empty directory — usually fs.unlink.
	EPERM			: 'EPERM',			// (Operation not permitted): An attempt was made to perform an operation that requires elevated privileges.
	EPIPE			: 'EPIPE',			// (Broken pipe): A write on a pipe, socket, or FIFO for which there is no process to read the data. Commonly encountered at the net and http layers, indicative that the remote side of the stream being written to has been closed.
	ETIMEDOUT		: 'ETIMEDOUT'		// (Operation timed out): A connect or send request failed because the connected party did not properly respond after a period of time. Usually encountered by http or net — often a sign that a socket.end() was not properly called.
	/* jshint ignore:end */
};

module.exports = class FileSystem {

	getListOfFiles(path, ignoreErrors = false) {
		return new Promise((resolve, reject) => {
			FS.readdir(path, (error, files) => {
				if (error) {
					reject(error);
					return;
				}
				const listOfFilesOnly = [];
				const checkers = [];
				files.forEach((file) => {
					checkers.push(new Promise((resolve, reject) => {
						FS.stat(Path.resolve(path, file), (error, stats) => {
							if (error) {
								if (ignoreErrors) {
									return resolve();
								} else {
									return reject(error);
								}
							}
							if (stats.isFile()) {
								listOfFilesOnly.push(file);
							}
							resolve(file);
						});
					}));
				});
				Promise.all(checkers)
					.then(() => {
						resolve(listOfFilesOnly);
					})
					.catch((error) => {
						reject(error);
					});
			});
		}).catch((e)=>{
			return Promise.reject(e);
		});
	}

	createFolder(dir){
		return new Promise((resolve, reject) => {
			FS.mkdir(dir, (error) => {
				if (error) {
					return reject(error);
				}
				resolve();
			});
		}).catch((e)=>{
			return Promise.reject(e);
		});
	}

	isFileExist(file){
		return new Promise((resolve, reject) => {
			FS.open(file, 'r', (error) => {
				if (error) {
					if (error.code === ERRORS.ENOENT) {
						return resolve(false);
					}
					return reject(error);
				}
				resolve(true);
			});
		}).catch((e)=>{
			return Promise.reject(e);
		});
	}

	appendStringToFile(str, dest, encoding = 'utf8'){
		return new Promise((resolve, reject) => {
			if (typeof str !== 'string') {
				return reject(new Error('Only string can be written within this method'));
			}
			if (typeof dest !== 'string' || dest.trim() === ''){
				return reject(new Error('Destination isn\'t defined.'));
			}
			FS.appendFile(dest, str, encoding, (error) => {
				if (error) {
					return reject(error);
				}
				resolve();
			});
		}).catch((e)=>{
			return Promise.reject(e);
		});
	}

	writeStringToFile(str, dest, encoding = 'utf8') {
		return new Promise((resolve, reject) => {
			if (typeof str !== 'string') {
				return reject(new Error('Only string can be written within this method'));
			}
			if (typeof dest !== 'string' || dest.trim() === ''){
				return reject(new Error('Destination isn\'t defined.'));
			}
			FS.writeFile(dest, str, encoding, (error) => {
				if (error) {
					return reject(error);
				}
				resolve();
			});
		}).catch((e)=>{
			return Promise.reject(e);
		});
	}


}
