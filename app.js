/* jshint esversion: 6 */
/* global __dirname */
(() => {
  'use strict';
  
  const architect = require('architect');
  const _ = require('lodash');
  const http = require('http');
  const util = require('util');
  const path = require('path');
  const express = require('express');
  const morgan = require('morgan');
  const request = require('request');
  const bodyParser = require('body-parser');
  const config = require('nconf');
  const Hashes = require('jshashes');
  const Keycloak = require('keycloak-connect');  
  const session = require('express-session');
  const RedisStore = require('connect-redis')(session);
  const SHA256 = new Hashes.SHA256;
  
  config.file({file: __dirname + '/config.json'});
   
  const options = require(__dirname + '/options');
  const architectConfig = architect.loadConfig(__dirname + '/config.js');
  
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
    const routes = architectApp.getService('live-delphi-routes');
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
    const sessionStore = new RedisStore();
    const keycloak = new Keycloak({ store: sessionStore }, {
      "realm": config.get('keycloak:realm'),
      "auth-server-url": config.get('keycloak:auth-server-url'),
      "ssl-required": config.get('keycloak:ssl-required'),
      "resource": config.get('keycloak:resource'),
      "public-client": config.get('keycloak:public-client')
    });
    
    httpServer.listen(port, () => {
      logger.info('Http server started');
    });
    
    app.use(session({
      store: sessionStore,
      secret: config.get('session-secret')
    }));
    
    app.use(keycloak.middleware({
      logout: '/logout'
    }));
    
    app.use((req, res, next) => {
      req.liveDelphi = {
        isLoggedIn: req.kauth && req.kauth.grant
      };
      
      next();
    });
    
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });

    app.use(morgan('combined'));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'pug');
    
    routes.register(app, keycloak);
    
    app.get('/keycloak.json', (req, res) => {
      res.header('Content-Type', 'application/json');
      res.send(config.get('keycloak'));
    });
    
    app.post('/join', (req, res) => {
      const keycloakServerUrl = config.get('keycloak:auth-server-url');
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
          const sessionId = liveDelphiModels.getUuid();
          
          liveDelphiModels.createSession(sessionId, userId)
            .then((session) => {
              res.send({
                sessionId: sessionId
              });
            })
            .catch((sessionErr) => {
              logger.error(sessionErr);
              res.status(500).send(sessionErr);
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
    
    function handleWebSocketError(client, operation) {
      return (err) => {
        let failedOperation = operation || 'UNKNOWN_OPERATION';
        logger.error(util.format('ERROR DURING OPERATION %s: %s', failedOperation, err));      
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
            .catch(handleWebSocketError(client, 'FIND_SESSION'));
        break;
        case 'comment-opened':
          liveDelphiModels.findSession(sessionId)
            .then((session) => {
              liveDelphiModels.findQueryUser(session.queryUserId)
                .then((queryUser) => {
                  const parentCommentId = liveDelphiModels.toUuid(message.commentId);
                  liveDelphiModels.listCommentsByParentCommentId(parentCommentId)
                    .then((childComments) => {
                      childComments.forEach((childComment) => {
                        client.sendMessage({
                          "type": "comment-added",
                          "data": {
                            "id": childComment.id,
                            "comment": childComment.comment,
                            "x": childComment.x,
                            "y": childComment.y,
                            "parentCommentId": childComment.parentCommentId
                          }
                        });
                      });
                    })
                    .catch(handleWebSocketError(client, 'LIST_COMMENTS_BY_PARENT_ID'));
                })
                .catch(handleWebSocketError(client, 'FIND_QUERY_USER'));
            })
            .catch(handleWebSocketError(client, 'FIND_SESSION'));
        break;
        case 'comment':
          liveDelphiModels.findSession(sessionId)
            .then((session) => {
              liveDelphiModels.findQueryUser(session.queryUserId)
                .then((queryUser) => {
                  const parentCommentId = message.parentCommentId ? liveDelphiModels.toUuid(message.parentCommentId) : null;
                  liveDelphiModels.findComment(parentCommentId)
                    .then((parentComment) => {
                      const comment = new liveDelphiModels.instance.Comment({
                        id: liveDelphiModels.getUuid(),
                        comment: message.comment,
                        parentCommentId: parentComment ? parentComment.id : null,
                        isRootComment: parentComment ? false : true,
                        x: message.x,
                        y: message.y,
                        created: new Date().getTime(),
                        queryId: queryUser.queryId,
                        queryUserId: queryUser.id
                      });

                      comment.save((saveErr) => {
                        if (saveErr) {
                          logger.error(saveErr);
                          return;
                        } else {
                          shadyMessages.trigger("client:comment-added", {
                            "comment": comment
                          });
                        }
                      });
                    })
                    .catch(handleWebSocketError(client, 'FIND_COMMENT'));
                })
                .catch(handleWebSocketError(client, 'FIND_QUERY_USER'));
            })
            .catch(handleWebSocketError(client, 'FIND_SESSION'));
        break;
        case 'join-query':
          const now = new Date();
          liveDelphiModels.listPeerQueryUsersBySessionId(sessionId)
            .then((queryUsers) => {
              queryUsers.forEach((queryUser) => {
                liveDelphiModels.findLatestAnswerByQueryUserAndCreated(queryUser.id, now)
                  .then((answer) => {
                    if (answer) {
                      console.log(answer.x, answer.y);
                      client.sendMessage({
                        "type": "answer-changed",
                        "data": {
                          "userHash": SHA256.hex(queryUser.id.toString()),
                          "x": answer ? answer.x : 0,
                          "y": answer ? answer.y : 0  
                        }
                      });
                    }
                  })
                  .catch(handleWebSocketError(client, 'FIND_LATEST_ANSWER_BY_QUERY_USER_AND_CREATED'));
              });
              const queryId = queryUsers[0].queryId || null;
              liveDelphiModels.listRootCommentsByQueryId(queryId)
                .then((rootComments) => {
                  rootComments.forEach((rootComment) => {
                    client.sendMessage({
                      "type": "comment-added",
                      "data": {
                        "id": rootComment.id,
                        "comment": rootComment.comment,
                        "x": rootComment.x,
                        "y": rootComment.y,
                        "parentCommentId": null
                      }
                    });
                  });
                })
                .catch(handleWebSocketError(client), 'LIST_ROOT_COMMENTS_BY_QUERY');
            })
            .catch(handleWebSocketError(client), 'LIST_PEER_QUERY_USERS_BY_SESSION');
        break;
        case 'get-queries':
          liveDelphiModels.findSession(sessionId)
            .then((session) => {
              //TODO: check what queries user is allowed to join
              liveDelphiModels.listQueriesCurrentlyInProgress()
                .then((queries) => {
                  queries.forEach((query) => {
                    client.sendMessage({
                      "type": "query-found",
                      "data": {
                        "id": query.id,
                        "name": query.name,
                        "thesis": query.thesis,
                        "ends": query.end
                      }
                    });
                  });
                })
                .catch(handleWebSocketError(client, 'LIST_CURRENT_QUERIES'));
            })
            .catch(handleWebSocketError(client, 'FIND_SESSION'));
        break;
        default:
          logger.error(util.format("Unknown message type %s", message.type));
        break;
      }      
    });

    shadyMessages.on("client:comment-added", (event, data) => {
      const comment = data.comment;
      
      webSockets.sendMessageToAllClients({
        "type": "comment-added",
        "data": {
          "id": comment.id,
          "comment": comment.comment,
          "x": comment.x,
          "y": comment.y,
          "parentCommentId": comment.parentCommentId || null
        }
      });
    });
    
    shadyMessages.on("client:answer-changed", (event, data) => {
      const answer = data.answer;
      
      console.log(answer.x, answer.y);
      
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