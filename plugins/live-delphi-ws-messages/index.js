/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const _ = require('lodash');
  const util = require('util');
  const config = require('nconf');
  const moment = require('moment');
  const uuid = require('uuid4');
  const Promise = require('bluebird');
  const Hashes = require('jshashes');
  const SHA256 = new Hashes.SHA256;
  
  class LiveDelphiWebsocketMessages {
    
    constructor (logger, models, shadyMessages) {
      this.logger = logger;
      this.models = models;
      this.shadyMessages = shadyMessages;
    }
    
    handleWebSocketError(client, operation) {
      return (err) => {
        const failedOperation = operation || 'UNKNOWN_OPERATION';
        this.logger.error(util.format('ERROR DURING OPERATION %s: %s', failedOperation, err));
        // TODO notify client
      };
    }
    
    onPing(message, client) {
      client.sendMessage({
        "type": "pong"
      });
    }
    
    onAnswerChanged(message, client, sessionId) {
      this.models.findSession(sessionId)
        .then((session) => {
          const queryUserId = session.queryUserId;
          this.models.createAnswer(queryUserId, message.x, message.y)
            .then((answer) => {
              this.shadyMessages.trigger("client:answer-changed", {
                "answer": answer
              });
            });
        })
        .catch(this.handleWebSocketError(client, 'FIND_SESSION'));
    }
    
    onCommentOpened(message, client, sessionId) {
      this.models.findSession(sessionId)
        .then((session) => {
          this.models.findQueryUser(session.queryUserId)
            .then((queryUser) => {
              const parentCommentId = message.commentId;
              this.models.listCommentsByParentCommentId(parentCommentId)
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
                .catch(this.handleWebSocketError(client, 'COMMENT_OPENED'));
            })
            .catch(this.handleWebSocketError(client, 'COMMENT_OPENED'));
        })
        .catch(this.handleWebSocketError(client, 'COMMENT_OPENED'));
    }
    
    onComment(message, client, sessionId) {
      this.models.findSession(sessionId)
        .then((session) => {
          this.models.findQueryUser(session.queryUserId)
            .then((queryUser) => {
              const parentCommentId = message.parentCommentId;
              this.models.findComment(parentCommentId)
                .then((parentComment) => {
                  const isRootComment = parentComment ? false : true;
                  const parentCommentId = parentComment ? parentComment.id : null;
                  const queryUserId = queryUser.id;
                  const queryId = queryUser.queryId;
                  const comment = message.comment;
                  const x = message.x;
                  const y = message.y;

                  this.models.createComment(isRootComment, parentCommentId, queryUserId, queryId, comment, x, y)
                    .then((comment) => {
                      this.shadyMessages.trigger("client:comment-added", {
                        "comment": comment
                      });
                    })
                    .catch((err) => {
                      this.logger.error(err);
                    });
                })
                .catch(this.handleWebSocketError(client, 'FIND_COMMENT'));
            })
            .catch(this.handleWebSocketError(client, 'FIND_QUERY_USER'));
        })
        .catch(this.handleWebSocketError(client, 'FIND_SESSION'));
    }
    
    onJoinQuery(message, client, sessionId) {
      const now = new Date();
      this.models.listPeerQueryUsersBySessionId(sessionId)
        .then((queryUsers) => {
          queryUsers.forEach((queryUser) => {
            this.models.findLatestAnswerByQueryUserAndCreated(queryUser.id, now)
              .then((answer) => {
                if (answer) {
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
              .catch(this.handleWebSocketError(client, 'FIND_LATEST_ANSWER_BY_QUERY_USER_AND_CREATED'));
          });

          const queryId = queryUsers[0].queryId || null;
          this.models.listRootCommentsByQueryId(queryId)
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
            .catch(this.handleWebSocketError(client), 'LIST_ROOT_COMMENTS_BY_QUERY');
        })
        .catch(this.handleWebSocketError(client), 'LIST_PEER_QUERY_USERS_BY_SESSION');
    }
    
    onGetQueries(message, client, sessionId) {
      this.models.findSession(sessionId)
        .then((session) => {
          //TODO: check what queries user is allowed to join
          this.models.listQueriesCurrentlyInProgress()
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
            .catch(this.handleWebSocketError(client, 'LIST_CURRENT_QUERIES'));
        })
        .catch(this.handleWebSocketError(client, 'FIND_SESSION'));
    }
    
    onMessage(event) {
      const message = event.data.message;
      const client = event.client;
      const sessionId = client.getSessionId();
      
      switch (message.type) {
        case 'ping':
          this.onPing(message, client);
        break;
        case 'answer':
          this.onAnswerChanged(message, client, sessionId);
        break;
        case 'comment-opened':
          this.onCommentOpened(message, client, sessionId);
        break;
        case 'comment':
          this.onComment(message, client, sessionId);
        break;
        case 'join-query':
          this.onJoinQuery(message, client, sessionId);
        break;
        case 'get-queries':
          this.onGetQueries(message, client, sessionId);
        break;
        default:
          this.logger.error(util.format("Unknown message type %s", message.type));
        break;
      }
    }
   
    register(webSockets) {
      webSockets.on("message", this.onMessage.bind(this));
    }
    
  };

  module.exports = (options, imports, register) => {
    const logger = imports.logger;
    const models = imports['live-delphi-models'];
    const shadyMessages = imports['shady-messages'];
     
    const websocketMessages = new LiveDelphiWebsocketMessages(logger, models, shadyMessages);
    
    register(null, {
      'live-delphi-ws-messages': websocketMessages
    });
  };

})();
