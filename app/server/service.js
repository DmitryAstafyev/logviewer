const SETTINGS = require('./config.js');

const Server = require('./libs/server.js');
const server = new Server();

server.create();

const Sources = require('./libs/sources/sources');
const sources = new Sources();
sources.init()
	.then(()=>{
		console.log('done');
	})
	.catch((e)=>{
		console.log(e);
	});
/*
let Serial = require('./libs/service.serial.js'),
    serial = new Serial();

serial.getListPorts();
serial.open();
    */