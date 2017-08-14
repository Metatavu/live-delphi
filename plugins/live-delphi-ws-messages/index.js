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
        this.models.findAnswerMaxCreatedAtByQueryId(queryId)
      ];
      
      Promise.all(queries)
        .then((data) => {
          client.sendMessage({
            "type": "query-duration",
            "data": {
              "first": new Date(data[0]).getTime(),
              "last": new Date(data[1]).getTime()
            }
          });
        })
        .catch(this.handleWebSocketError(client, 'GET_QUERY_DURATION'));
    }
    
    getQueryCommentsDuration(message, client, sessionId) {
      const queryId = message.data.queryId;
      
      this.models.listQueryUsersByQueryId(queryId)
        .then((queryUsers) => {
          const promiseArray = _.map(queryUsers, (queryUser) => {
            return this.models.findFirstAnswerAndLastCommentByQueryUserId(queryUser.id, queryId);
          });
          
          Promise.all(promiseArray)
            .then((allAnswers) => {
              const answerAndComment = allAnswers.filter((answer) => { return answer; });
              const first = new Date(answerAndComment[0].first).getTime();
              const last = new Date(answerAndComment[0].latest).getTime();
              
              client.sendMessage({
                "type": "query-duration",
                "data": {
                  "first": first,
                  "last": last
                }
              });
            })
            .catch(this.handleWebSocketError(client, 'GET_QUERY_COMMENTS_DURATION'));
        });
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
      
      const createdBefore = before ? new Date(before) : nulls;
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
        case 'find-query-comments-duration':
          this.getQueryCommentsDuration(message, client, sessionId);
        break;
        case 'list-latest-answers':
          this.listLatestAnswers(message, client, sessionId);
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
