/* eslint-disable no-undef,global-require,no-console */
// jshint ignore: start
describe('[Test][Source: serial port]', () => {
	it('[List of ports. Open / close port. Subscriptions. ]', (done)=>{
		const INTERFACE = require('../../libs/sources/source.interface.desc');
		const implementation = require('../../libs/sources/implementations/implementation.serial');
		const Source = implementation.Source;
		const source = new Source();
		const interfaceExtraMethods = implementation.SourceExtraMethods;
		const user = 'jasmine';
		source[interfaceExtraMethods.getPortsList]()
			.then((ports) => {
				expect(ports instanceof Array).toBe(true);
				expect(ports.length > 0).toBe(true);
				const port = ports[0].comName;
				const tests = [
					new Promise((resolve) => {
						console.log(`Subscription to [open] event for ${port}.`);
						source.subscribe(INTERFACE.SourceImplementationEvents.opened, (info) => {
							expect(info.users.indexOf(user)).toBe(0);
							expect(info.type).toBe(implementation.type);
							console.log(`Open event for ${port} is handled.`);
							return resolve();
						});
					}),
					new Promise((resolve) => {
						console.log(`Subscription to [close] event for ${port}.`);
						source.subscribe(INTERFACE.SourceImplementationEvents.closed, (info) => {
							expect(info.users.indexOf(user)).toBe(0);
							expect(info.type).toBe(implementation.type);
							console.log(`Close event for ${port} is handled.`);
							return resolve();
						});
					}),
					new Promise((resolve, reject) => {
						console.log(`Attempt to open port: ${port}`);
						source[INTERFACE.SourceImplementationMethods.open](user, { port: port})
							.then(() => {
								const users = source[INTERFACE.SourceImplementationMethods.getUsers]();
								expect(users.length).toBe(1);
								console.log(`Attempt to close port: ${port}`);
								source[INTERFACE.SourceImplementationMethods.close](user, port)
									.then(() => {
										console.log(`Port ${port} is closed.`);
										const users = source[INTERFACE.SourceImplementationMethods.getUsers]();
										expect(users.length).toBe(0);
										resolve();
									})
									.catch((e) => {
										console.log(e);
										expect(false).toBe(true);
										resolve();
									});
							})
							.catch((e) => {
								console.log(e);
								expect(false).toBe(true);
								reject(e);
							});
					})
				];
				Promise.all(tests)
					.then(done)
					.catch(done);

			})
			.catch((e) => {
				console.log(e);
				expect(false).toBe(true);
				done();
			});
	});

});