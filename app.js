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
  const Hashes = require('jshashes');
  const SHA256 = new Hashes.SHA256;
  
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
    
    app.post('/join', (req, res) => {
      const keycloakServerUrl = config.get('keycloak:server-url');
      const keycloakRealm = config.get('keycloak:realm');
      const keycloakUrl = util.format('%s/realms/%s/protocol/openid-connect/userinfo', keycloakServerUrl, keycloakRealm);
      
      request.get(keycloakUrl, {
        'auth': {
          'bearer': req.body.token
        }
      }, (authErr, response, body) => {
        if (authErr) {
          // TODO: Better error handling
          logger.error(authErr);
          res.status(403).send(authErr);
        } else {
          const reponse = JSON.parse(body);
          const userId = reponse.sub;
          
          const session = new liveDelphiModels.instance.Session({
            id: liveDelphiModels.getUuid(),
            created: new Date().getTime(),
            userId: userId
          });
          
          session.save((sessionErr) => {
            if (sessionErr) {
              logger.error(sessionErr);
              res.status(500).send(sessionErr);
            } else {
              res.send({
                sessionId: session.id
              });
            }
          });
        }
      });
    });
    
    app.post('/joinQuery/:queryId', (req, res) => {
      const queryId = liveDelphiModels.toUuid(req.params.queryId);
      const sessionId = liveDelphiModels.toUuid(req.body.sessionId);
      
      // TODO: Check if user has permission to join query
      // TODO: Check if query exists
      
      liveDelphiModels.instance.Session.findOne({ id: sessionId }, (sessionErr, session) => {
        if (sessionErr) {
          logger.error(sessionErr);
          res.status(500).send(sessionErr);
        } else {
          if (!session) {
            res.status(403).send();
            return;
          }
          
          const userId = session.userId;
          
          liveDelphiModels.instance.QueryUser.findOne({ queryId: queryId, userId: userId }, (queryUserFindErr, queryUser) => {
            if (queryUserFindErr) {
              logger.error(queryUserFindErr);
              res.status(500).send(queryUserFindErr);
              return;
            }
            
            if (queryUser) {
              session.queryUserId = queryUser.id;
              session.save((sessionSaveErr) => {
                if (sessionSaveErr) {
                  logger.error(sessionSaveErr);
                  res.status(500).send(sessionSaveErr);
                  return;
                }
                
                res.send("OK");
              });
              
              return;
            }
            
            const newQueryUser = new liveDelphiModels.instance.QueryUser({
              id: liveDelphiModels.getUuid(),
              queryId: queryId,
              userId: session.userId,
              created: new Date().getTime()
            });

            newQueryUser.save((queryUserSaveErr) => {
              if (queryUserSaveErr) {
                logger.error(queryUserSaveErr);
                res.status(500).send(queryUserSaveErr);
              } else {
                session.queryUserId = newQueryUser.id;
                session.save((sessionSaveErr) => {
                  if (sessionSaveErr) {
                    logger.error(sessionSaveErr);
                    res.status(500).send(sessionSaveErr);
                    return;
                  }

                  res.send("OK");
                });
                
                return;
              }
            });
          });
        }
      });
    });
    
    const webSockets = new WebSockets(httpServer);
    
    function handleWebSocketError(client) {
      return (err) => {
        logger.error(err);      
        // TODO notify client
      };
    }
    
    webSockets.on("message", (event) => {
      const message = event.data.message;
      const client = event.client;
      const sessionId = liveDelphiModels.toUuid(client.getSessionId());
      
      switch (message.type) {
        case 'answer':
          liveDelphiModels.findSession(sessionId)
            .then((session) => {
              const queryUserId = session.queryUserId;
              const answer = new liveDelphiModels.instance.Answer({
                id: liveDelphiModels.getUuid(),
                x: message.x,
                y: message.y,
                created: new Date().getTime(),
                queryUserId: queryUserId
              });
              
              answer.save((saveErr) => {
                if (saveErr) {
                  logger.error(saveErr);
                  return;
                } else {
                  shadyMessages.trigger("client:answer-changed", {
                    "answer": answer
                  });
                }
              });
            })
            .catch(handleWebSocketError(client));
        break;
        case 'join-query':
          const now = new Date();
          
          liveDelphiModels.listPeerQueryUsersBySessionId(sessionId)
            .then((queryUsers) => {
              queryUsers.forEach((queryUser) => {
                liveDelphiModels.findLatestAnswerByQueryUserAndCreated(queryUser.id, now)
                  .then((answer) => {
                    client.sendMessage({
                      "type": "answer-changed",
                      "data": {
                        "userHash": SHA256.hex(queryUser.id.toString()),
                        "x": answer.x,
                        "y": answer.y  
                      }
                    });
                  })
                  .catch(handleWebSocketError(client));
              });
            })
            .catch(handleWebSocketError(client));
        break;
        default:
          logger.error(util.format("Unknown message type %s", message.type));
        break;
      }
    });
    
    shadyMessages.on("client:answer-changed", (event, data) => {
      const answer = data.answer;
      
      webSockets.sendMessageToAllClients({
        "type": "answer-changed",
        "data": {
          "userHash": SHA256.hex(answer.queryUserId.toString()),
          "x": answer.x,
          "y": answer.y
        }
      });
    });
   
  });

})();