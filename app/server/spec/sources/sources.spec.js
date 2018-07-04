/* eslint-disable no-undef,global-require,no-console */
// jshint ignore: start
describe('[Test][Sources]', () => {
	it('[Loading]', (done)=>{
		const Sources = require('../../libs/sources/sources');
		const sources = new Sources();
		sources.init()
			.then((sources) => {
				expect(sources instanceof Array).toBe(true);
				sources.forEach((source) => {
					console.log(`Loaded source: ${source.getType()}`);
				});
				done();
			})
			.catch((e)=>{
				console.log(e);
				expect(false).toBe(true);
				done();
			});
	});

});