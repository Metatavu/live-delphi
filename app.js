/* jshint esversion: 6 */
/* global __dirname */
(() => {
  'use strict';
  
  const architect = require('architect');
  const options = require(__dirname + '/options');
  
  if (!options.isOk()) {
    options.printUsage();
    process.exitCode = 1;
    return;
  }
  
  module.exports = function setup(options, imports, register) {
    const _ = require('lodash');
    const architect = require('architect');
    const http = require('http');
    const uuid = require('uuid4');
    const util = require('util');
    const express = require('express');
    const morgan = require('morgan');
    const bodyParser = require('body-parser');
    const shadyMessages = imports['shady-messages'];

    const workerId = uuid();
    const argv = require('yargs')
      .usage('Worker \nUsage: $0')
      .demand('p')
      .alias('p', 'port')
      .describe('p', 'Port')
      .demand('h')
      .alias('h', 'host')
      .describe('h', 'Host')
      .argv;

    const port = argv.port;
    const host = argv.host;

    const app = express();
    const httpServer = http.createServer(app);
    
    httpServer.listen(port, () => {
      console.log('Server is listening on port ' + port);
    });

    app.use(morgan('combined'));
    app.use(express.static(__dirname + '/public'));
    app.set('views', __dirname + '/views');
    app.set('view engine', 'pug');
    app.use(bodyParser.urlencoded({ extended: true }));

    app.get('/', function (req, res) {
      res.render('index');
    });
   
    const WebSockets = imports['shady-websockets'];
    
    const webSockets = new WebSockets(httpServer);
    
    webSockets.on("message", (event) => {
      event.client.sendMessage({
        "test": "test"  
      });
      
      shadyMessages.trigger("client:test", {
        "test": "test"  
      });
    });
    
    shadyMessages.on("client:test", (data) => {
      console.log(workerId, "received", data);
    });
   
    console.log(util.format("Worker started at %s:%d", host, port));
    
    register(null, {
      "live-delphi": null
    });
  };

})();