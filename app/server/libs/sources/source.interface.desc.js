const SourceImplementationMethods = {
	open: 'open',
	close: 'close',
	send: 'send',
	subscribe: 'subscribe',
	unsubscribe: 'unsubscribe',
	getInfo: 'getInfo'
};

const SourceImplementationEvents = {
	opened: 'opened',
	closed: 'closed',
	data: 'data'
};

module.exports = {
	SourceImplementationMethods: SourceImplementationMethods,
	SourceImplementationEvents: SourceImplementationEvents
};