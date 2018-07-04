const Jasmine = require('jasmine');
const jasmine = new Jasmine();
jasmine.loadConfigFile('spec/support/jasmine.json');
jasmine.onComplete(function(passed) {
	if (passed) {
		console.log('All specs have passed');
	}
	else {
		console.log('At least one spec has failed');
	}
});
jasmine.execute();
