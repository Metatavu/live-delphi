/* jshint esversion: 6 */
/* global __dirname */
(() => {
  'use strict';
  
  const architect = require('architect');
  const _ = require('lodash');
  const http = require('http');
  const util = require('util');
  const express = require('express');
  const morgan = require('morgan');
  const request = require('request');
  const bodyParser = require('body-parser');
  const config = require('nconf');

  const options = require(__dirname + '/options');
  const architectConfig = architect.loadConfig(__dirname + '/config.js');
  
  config.file({file: __dirname + '/config.json'});
   
  if (!options.isOk()) {
    options.printUsage();
    process.exitCode = 1;
    return;
  }
  
  architect.createApp(architectConfig, (err, architectApp) => {
    if (err) {
      console.error(err);
      process.exitCode = 1;
      return;
    }
    
    const shadyMessages = architectApp.getService('shady-messages');
    const shadyWorker = architectApp.getService('shady-worker');
    const WebSockets = architectApp.getService('shady-websockets');
    const liveDelphiModels = architectApp.getService('live-delphi-models');
    const logger = architectApp.getService('logger');
    
    const workerId = shadyWorker.start(config.get("server-group"), options.getOption('port'), options.getOption('host'));

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
      logger.info('Http server started');
    });
    
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });

    app.use(morgan('combined'));
    app.use(express.static(__dirname + '/public'));
    app.use(bodyParser.urlencoded({ extended: true }));
    
    app.post('/join', function (req, res) {
      const keycloakServerUrl = config.get('keycloak:server-url');
      const keycloakRealm = config.get('keycloak:realm');
      const keycloakUrl = util.format('%s/realms/%s/protocol/openid-connect/userinfo', keycloakServerUrl, keycloakRealm);
      
      request.get(keycloakUrl, {
        'auth': {
          'bearer': req.body.token
        }
      }, (err, response, body) => {
        if (err) {
          // TODO: Better error handling
          console.log(err);
          res.send(403);
        } else {
          const reponse = JSON.parse(body);
          const userId = reponse.sub;
          
          const session = new liveDelphiModels.instance.Session({
            id: liveDelphiModels.getUuid(),
            created: new Date().getTime(),
            userId: userId
          });
          
          session.save((err) => {
            if (err) {
              console.log(err);
              res.send(500);
            } else {
              res.send({
                sessionId: session.id
              });
            }
          });
        }
      });
    });
    
    const webSockets = new WebSockets(httpServer);
    
    webSockets.on("message", (event) => {
      const message = event.data.message;
      switch (message.type) {
        case 'answer':
          const answer = new liveDelphiModels.instance.Answer({
            id: liveDelphiModels.getUuid(),
            x: message.x,
            y: message.y,
            created: new Date().getTime()
          });
          
          answer.save((err) => {
            if (err) {
              console.log(err);
              return;
            } else {
              event.client.sendMessage({
                "status": "saved"
              });
              
              shadyMessages.trigger("client:answer", {
                "answer": answer
              });
            }
          });
        break;
        default:
        break;
      }
    });
    
    shadyMessages.on("client:answer", (event, data) => {
      console.log(workerId, "received", data);
    });
   
  });

})();