const SourceImplementationMethods = {
	open: 'open',
	close: 'close',
	send: 'send',
	subscribe: 'subscribe',
	unsubscribe: 'unsubscribe'
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