/* eslint-disable no-undef */
// jshint ignore: start
describe('[Test][Source: serial port]', () => {
	it('[Basic communication]', (done)=>{
		const t = 1;
		expect(t).toBe(1);
		done();
	});

});


/*
describe('[Test][Server <-> Client][longpoll]', () => {
    it('[Basic communication]', (done: Function)=>{
        const logger = new Tools.Logger('Test: longpoll');

        logger.debug('Create server');
        const connection = new HTTPLongpoll.ConnectionParameters({});
        const server = new HTTPLongpoll.Server(connection);
        expect(connection instanceof HTTPLongpoll.ConnectionParameters).toBe(true);
        expect(server instanceof HTTPLongpoll.Server).toBe(true);
        server.destroy()
        .then(()=>{
            logger.debug('Destroy server');
            done();
        })
        .catch((error)=>{
            throw error;
        });
    });

});
* */