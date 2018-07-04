module.exports = class PromiseTasks {

	constructor(){
		this._tasks = [];
		this._working = false;
		this._breaker = null;
	}

	add(task){
		if (this._breaker !== null) {
			return false;
		}
		this._tasks.push(task);
		this._next();
		return true;
	}

	stop(){
		return new Promise((resolve) => {
			this._breaker = resolve;
			if (this._tasks.length === 0) {
				return resolve();
			}
		});
	}

	isBusy(){
		return this._tasks.length !== 0;
	}

	_next(){
		if (this._breaker !== null){
			return this._breaker();
		}
		if (this._working){
			return;
		}
		if (this._tasks.length === 0) {
			return;
		}
		this._working = true;
		const task = this._tasks[0];
		task().then(()=>{
			this._tasks.splice(0, 1);
			this._working = false;
			this._next();
		}).catch((e)=>{
			this._working = false;
			this._next();
			return Promise.reject(e);
		});
	}
};