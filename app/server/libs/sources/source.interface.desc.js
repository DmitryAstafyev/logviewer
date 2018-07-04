const SourceImplementationMethods = {
	open: 'open',
	close: 'close',
	send: 'send',
	subscribe: 'subscribe',
	unsubscribe: 'unsubscribe',
	getType: 'getType',
	getUsers: 'getUsers'
};

const SourceImplementationEvents = {
	opened: 'opened',
	closed: 'closed',
	data: 'data',
	error: 'error'
};

module.exports = {
	SourceImplementationMethods: SourceImplementationMethods,
	SourceImplementationEvents: SourceImplementationEvents
};