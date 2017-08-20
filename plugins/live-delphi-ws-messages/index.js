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
  const SHA256 = new Hashes.SHA256();
  
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
          return this.models.findQueryUser(queryUserId)
            .then((queryUser) => {
              if (queryUser) {
                return this.models.createAnswer(queryUserId, message.x, message.y)
                  .then((answer) => {
                    this.shadyMessages.trigger("client:answer-changed", {
                      "queryId": queryUser.queryId,
                      "answer": answer
                    });
                  });
              } else {
                this.logger.warn(`QueryUser ${queryUserId} not found`);
              }
            });
        })
        .catch(this.handleWebSocketError(client, 'FIND_SESSION'));
    }
    
    onListChildComments(message, client, sessionId) {
      const parentCommentId = message.parentCommentId;
      
      this.models.listCommentsByParentCommentId(parentCommentId)
        .then((childComments) => {
          childComments.forEach((childComment) => {
            client.sendMessage({
              "type": "comment-found",
              "data": {
                "id": childComment.id,
                "comment": childComment.comment,
                "x": childComment.x,
                "y": childComment.y,
                "parentCommentId": childComment.parentCommentId,
                "createdAt": childComment.createdAt
              }
            });
          });
        })
        .catch(this.handleWebSocketError(client, 'LIST_CHILD_COMMENTS'));
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
                        "parentCommentId": childComment.parentCommentId,
                        "createdAt": childComment.createdAt
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
    
    onListActiveQueries(message, client, sessionId) {
      this.models.findSession(sessionId)
        .then((session) => {
          //TODO: check what queries user is allowed to join
          this.models.listQueriesCurrentlyInProgress()
            .then((queries) => {
              client.sendMessage({
                "type": "queries-found",
                "data": {
                  "queries": _.map(queries, (query) => {
                      return {
                        "id": query.id,
                        "name": query.name,
                        "thesis": query.thesis,
                        "labelX": query.labelx,
                        "labelY": query.labely,
                        "colorX": query.colorx,
                        "colorY": query.colory,
                        "ends": query.end
                      };
                    })
                }
              });
            })
            .catch(this.handleWebSocketError(client, 'LIST_CURRENT_QUERIES'));
        })
        .catch(this.handleWebSocketError(client, 'LIST_CURRENT_QUERIES'));
    }
    
    getQueryDuration(message, client, sessionId) {
      const queryId = message.data.queryId;
      const queries = [
        this.models.findAnswerMinCreatedAtByQueryId(queryId),
        this.models.findAnswerMaxCreatedAtByQueryId(queryId),
        this.models.findCommentMinCreatedAtByQueryId(queryId),
        this.models.findCommentMaxCreatedAtByQueryId(queryId)
      ];
      
      Promise.all(queries)
        .then((data) => {
          const firstAnswer = data[0] ? new Date(data[0]).getTime() : null;
          const lastAnswer = data[1] ? new Date(data[1]).getTime() : null;
          const firstComment = data[2] ? new Date(data[2]).getTime() : null;
          const lastComment = data[3] ? new Date(data[3]).getTime() : null;
          const first = firstAnswer && firstComment ? Math.min(firstAnswer, firstComment) : firstAnswer || firstComment;
          const last = lastAnswer && lastComment ? Math.max(lastAnswer, lastComment) : lastAnswer || lastComment;
          
          client.sendMessage({
            "type": "query-duration",
            "data": {
              "first": first,
              "last": last
            }
          });
        })
        .catch(this.handleWebSocketError(client, 'GET_QUERY_DURATION'));
    }
    
    listLatestAnswers(message, client, sessionId) {
      const queryId = message.data.queryId;
      const before = message.data.before;
      const after = message.data.after;
      const resultMode = message.data.resultMode||'single';
      
      if (!queryId) {
        this.logger.error(`Received list-latest-answers without queryId parameter`);
        return;
      }
      
      if (!before && !after) {
        this.logger.error(`Received list-latest-answers without before and after parameters`);
        return;
      }
      
      const createdBefore = before ? new Date(before) : null;
      const createdAfter = after ? new Date(after) : null;
      let listPromise = null;
      
      if (createdBefore && createdAfter) {
        listPromise = this.models.listLatestAnswersByQueryIdAndCreatedBetween(queryId, createdBefore, createdAfter);
      } else if (createdBefore) {
        listPromise = this.models.listLatestAnswersByQueryIdAndCreatedLte(queryId, createdBefore);
      } else if (after) {
        listPromise = this.models.listLatestAnswersByQueryIdAndCreatedGte(queryId, createdAfter);
      }
      
      listPromise
        .then((answers) => {
          if (resultMode === 'single')  {
            _.compact(answers).forEach((answer) => {
              client.sendMessage({
                "type": "answer-found",
                "data": {
                  "queryId": queryId,
                  "userHash": SHA256.hex(answer.queryUserId.toString()),
                  "x": answer ? answer.x : 0,
                  "y": answer ? answer.y : 0,
                  "createdAt": answer ? answer.createdAt : null
                }
              });
            });
          } else {
            client.sendMessage({
              "type": "answers-found",
              "data": {
                "queryId": queryId,
                "answers": _.map(_.compact(answers), (answer) => {
                  return {
                    "userHash": SHA256.hex(answer.queryUserId.toString()),
                    "x": answer ? answer.x : 0,
                    "y": answer ? answer.y : 0,
                    "createdAt": answer ? answer.createdAt : null
                  };
                })
              }
            });
          }
        });
        
    }
    
    listRootCommentsByQuery(message, client, sessionId) {
      const queryId = message.data.queryId;
      const resultMode = message.data.resultMode||'single';
      
      if (!queryId) {
        this.logger.error(`Received list-latest-answers without queryId parameter`);
        return;
      }
      
      this.models.listRootCommentsByQueryId(queryId)
        .then((rootComments) => {
          if (resultMode === 'batch') {
            client.sendMessage({
              "type": "comments-added",
              "data": {
                "comments": _.map(rootComments, (rootComment) => {
                  return {
                    "id": rootComment.id,
                    "comment": rootComment.comment,
                    "x": rootComment.x,
                    "y": rootComment.y,
                    "parentCommentId": null,
                    "createdAt": rootComment.createdAt
                  };
                })
              }
            });
          } else { 
            rootComments.forEach((rootComment) => {
              client.sendMessage({
                "type": "comment-added",
                "data": {
                  "id": rootComment.id,
                  "comment": rootComment.comment,
                  "x": rootComment.x,
                  "y": rootComment.y,
                  "parentCommentId": null,
                  "createdAt": rootComment.createdAt
                }
              });
            });
          }
        })
        .catch(this.handleWebSocketError(client), 'LIST_ROOT_COMMENTS_BY_QUERY');
    }
    
    findCommentsByTime(message, client, sessionId) {
      const queryId = message.data.queryId;
      const time = message.data.currentTime;
      
      const start = new Date(time);
      const end = new Date(time + 1000);
      
      this.models.listQueryUsersByQueryId(queryId)
        .then((queryUsers) => {
          queryUsers.forEach((queryUser) => {
            this.models.findCommentsByTimeAndQueryUserId(start, end, queryUser.id)
            .then((comments) => {
              comments.forEach((comment) => {
                client.sendMessage({
                  "type": "comment-found",
                  "data": {
                    "userHash": SHA256.hex(queryUser.id.toString()),
                    "x": comment ? comment.x : 0,
                    "y": comment ? comment.y : 0,
                    "comment": comment.comment,
                    "commentId": comment.id,
                    "isRootComment": comment.isRootComment == 1 ? true : false,
                    "parent": comment.parentCommentId ? comment.parentCommentId : null,
                    "createdAt": comment ? comment.createdAt : null,
                    "updatedAt": comment.updatedAt
                  }
                });
              });
            });
          });
        });
    }
    
    findCommentsToRemoveByTime (message, client, sessionId) {
      const queryId = message.data.queryId;
      const time = new Date(message.data.currentTime);
      
      this.models.listCommentsNewerThanGivenTimeByQueryId(queryId, time)
        .then((comments) => {
          comments.forEach((comment) => {
            client.sendMessage({
              "type": "comment-to-remove-found",
              "data": {
                "commentId": comment.id
              }
            });
          });
        });
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
        case 'list-child-comments':
          this.onListChildComments(message, client, sessionId);
        break;
        case 'comment-opened':
          this.onCommentOpened(message, client, sessionId);
        break;
        case 'comment':
          this.onComment(message, client, sessionId);
        break;
        case 'list-active-queries':
          this.onListActiveQueries(message, client, sessionId);
        break;
        case 'find-query-duration':
          this.getQueryDuration(message, client, sessionId);
        break;
        case 'list-latest-answers':
          this.listLatestAnswers(message, client, sessionId);
        break;
        case 'list-root-comments-by-query':
          this.listRootCommentsByQuery(message, client, sessionId);
        break;
        case 'find-comments-by-time':
          this.findCommentsByTime(message, client, sessionId);
        break;
        case 'find-comments-to-remove-by-time':
          this.findCommentsToRemoveByTime(message, client, sessionId);
        break;
        default:
          this.logger.error(util.format("Unknown message type %s", message.type));
        break;
      }
    }
   
    register(webSockets) {
      webSockets.on("message", this.onMessage.bind(this));
    }
    
  }

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
