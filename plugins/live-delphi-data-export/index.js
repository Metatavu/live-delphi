/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const async = require('async');
  const util = require('util');
  const Promise = require('bluebird');
  const xlsx = require('node-xlsx');
  const slugify = require('slugify');
  const moment = require('moment');
  const Hashes = require('jshashes');
  const SHA256 = new Hashes.SHA256();
  const QueryScale2dEntry = require(`${__dirname}/queryscale2dentry`);
  const QueryScale2dData = require(`${__dirname}/queryscale2ddata`);
  
  class DataExport {
    
    constructor (logger, models) {
      this.logger = logger;
      this.models = models;
    }
    
    exportQueryLatestAnswerDataAsXLSX(queryId) {
      return this.exportQueryLatestAnswerData(queryId)
        .then((exportData) => {
          const rows = [];
          const query = exportData.query;
          
          rows.push(['Vastaajan tunniste', query.labelx, query.labely]);
          
          return {
            filename: `${slugify(query.name)}-latest-answers.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: xlsx.build([{name: 'Vastaukset', data: rows.concat(exportData.rows) }])
          };
        });
    }
    
    exportQueryAnswerDataWithTimesAsXLSX(queryId) {
      return this.exportQueryAnswerDataWithTimes(queryId)
        .then((exportData) => {
          const rows = [];
          const query = exportData.query;
          
          rows.push(['Vastausaika', 'Vastaajan tunniste', query.labelx, query.labely]);
          
          return {
            filename: `${slugify(query.name)}-with-times.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: xlsx.build([{name: 'Vastaukset', data: rows.concat(exportData.rows) }])
          };
        });
    }
    
    exportQueryCommentsAsXLSX(queryId) {
      return this.exportQueryComments(queryId)
        .then((exportData) => {
          const rows = [];
          const query = exportData.query;
          
          rows.push(['Vastaajan tunniste', query.labelx, query.labely, 'Aloituskommentti', 'Vastaus']);

          return {
            filename: `${slugify(query.name)}-comments.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: xlsx.build([{name: 'Kommentit', data: rows.concat(exportData.rows) }])
          };
        });
    }
    
    /**
     * Exports query latest data
     * 
     * @param {Query} query
     * @return {nm$_index.index=>#3.QueryDataScale2d}
     */
     /* jshint ignore:start */
    async exportQueryLatestAnswerDataAsQueryData(query) {
      const answerData = await this.exportQueryLatestAnswerData(query.id);
      return new QueryScale2dData(answerData.rows.map((row) => {
        return new QueryScale2dEntry(row[0], row[1], row[2]);
      }));
    }
    
    /* jshint ignore:end */
   
    /**
     * Exports query data as object. 
     * 
     * @deprecated Deprecated method, use exportQueryLatestAnswerDataAsQueryData instead.
     * @param {Number} queryId query id
     * @return {Promise} promise for query latest answer data
     */
    exportQueryLatestAnswerData(queryId) {
      return this.models.findQuery(queryId)
        .then((query) => {
          if (!query) {
            throw new Error({
              code: 404,
              message: "Query not found"
            });
          }
      
          return this.models.listQueryUsersByQueryIdAndUserIdNotNull(query.id)
            .then((queryUsers) => {
              const promiseArray = _.map(queryUsers, (queryUser) => {
                return this.models.findLatestAnswerByQueryUser(queryUser.id)
                  .then((answer) => {
                    return {
                      answer: answer,
                      queryUser: queryUser
                    };
                  });

              });

              return Promise.all(promiseArray);
            })
            .then((answerDatas) => {
              const rows = [];
              answerDatas.forEach((answerData) => {
                const answer = answerData.answer;
                const queryUser = answerData.queryUser;      
                const userHash = queryUser.userId ? SHA256.hex(queryUser.userId.toString()) : null;
                if (userHash && answer && answer.x && answer.y) {
                  rows.push([userHash, answer.x, answer.y]);
                }
              });

              return {
                rows: rows,
                query: query
              };
            });
        });
    }
    
    exportQueryAnswerDataWithTimes(queryId) {
      return this.models.findQuery(queryId)
        .then((query) => {
          if (!query) {
            throw new Error({
              code: 404,
              message: "Query not found"
            });
          }
      
          return this.models.listQueryUsersByQueryIdAndUserIdNotNull(query.id)
            .then((queryUsers) => {
              const promiseArray = _.map(queryUsers, (queryUser) => {
                return this.models.listAnswersByQueryUserId(queryUser.id)
                  .then((answers) => {
                    return {
                      answers: answers,
                      queryUser: queryUser
                    };
                  });

              });

              return Promise.all(promiseArray);
            })
            .then((answerDatas) => {
              const answers = [];
              
              answerDatas.forEach((answerData) => {
                const userHash = answerData.queryUser.userId ? SHA256.hex(answerData.queryUser.userId.toString()) : null;
                if (userHash) {
                  answerData.answers.forEach((answer) => {
                    answers.push({
                      userHash: userHash,
                      x: answer.x,
                      y: answer.y,
                      createdAt: moment(answer.createdAt)
                    });
                  });
                }
              });
                
              return {
                answers: answers,
                query: answerDatas.query
              };
            })
            .then((answerDatas) => {
              const rows = [];
              const answers = answerDatas.answers;
              
              answers.sort((a, b) => {
                return a.createdAt.diff(b.createdAt);
              });
              
              answers.forEach((answer) => {    
                if (answer && answer.x && answer.y) {
                  rows.push([new Date(answer.createdAt), answer.userHash, answer.x, answer.y]);
                }
              });

              return {
                rows: rows,
                query: query
              };
            });
        });
    }
    
    exportQueryComments (queryId) {
      return this.models.findQuery(queryId)
        .then((query) => {
          if (!query) {
            throw new Error({
              code: 404,
              message: "Query not found"
            });
          }
          
          return this.models.listCommentsByQueryId(query.id)
            .then((comments) => {
              const queryUserIds = _.uniq(_.map(comments, 'queryUserId'));

              const queryUserPromises = _.map(queryUserIds, (queryUserId) => {
                return this.models.findQueryUser(queryUserId);
              });

              return Promise.all(queryUserPromises)
                .then((queryUsers) => {
                  const queryUserMap = _.keyBy(queryUsers, 'id');

                  comments.forEach((comment) => {
                    comment.queryUser = queryUserMap[comment.queryUserId];
                  });

                  return {
                    comments: comments,
                    query: query
                  };
                });
            })
            .then((exportData) => {
              const comments = exportData.comments;
              const query = exportData.query;
              const rootComments = [];
              const childComments = {};

              comments.forEach((comment) => {
                const parentCommentId = comment.parentCommentId ? comment.parentCommentId.toString() : null;
                if (parentCommentId) {
                  if (!childComments[parentCommentId]) {
                    childComments[parentCommentId] = [];
                  }

                  childComments[parentCommentId].push(comment);
                } else {
                  rootComments.push(comment);
                }
              });

              rootComments.forEach((rootComment) => {
                rootComment.childComments = childComments[rootComment.id.toString()]||[];
              });

              return {
                rootComments: rootComments,
                query: query
              };
            })
            .then((exportData) => {
              const rootComments = exportData.rootComments;
              const query = exportData.query;
              const rows = [];
              
              rootComments.forEach((rootComment) => {
                const rootCommentUserId = rootComment.queryUser.userId;
                if (rootCommentUserId) {
                  const rootCommentUserHash = SHA256.hex(rootCommentUserId.toString());
                  rows.push([rootCommentUserHash, rootComment.x, rootComment.y, rootComment.comment, null]);

                  rootComment.childComments.forEach((childComment) => {
                    const childCommentUserId = childComment.queryUser.userId;
                    if (childCommentUserId) {
                      const childCommentUserHash = SHA256.hex(childCommentUserId.toString());
                      rows.push([childCommentUserHash, childComment.x, childComment.y, null, childComment.comment]);
                    }
                  });
                }
              });

              return {
                rows: rows,
                query: query
              };
            });
      });
    }
    
  } 
  
  module.exports = (options, imports, register) => {
    const models = imports['live-delphi-models'];
    const logger = imports['logger'];
    const dataExport = new DataExport(logger, models);
    
    register(null, {
      'live-delphi-data-export': dataExport
    });
  };
  
})();