/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const async = require('async');
  const util = require('util');
  
  class LiveDelphiModels {
    
    constructor (models) {
      this._models = models;
      this._registeredModels = [];
      
      this._registerModel('Query', {
        fields: {
          id: "uuid",
          start: "timestamp",
          end: "timestamp",
          name: "text",
          thesis: "text",
          type: "text"
        },
        key : [ [ "id" ] ],
        indexes: ["id", "start", "end" ]
      });
      
      this._registerModel('QueryUser', {
        fields: {
          id: "uuid",
          queryId: "uuid",
          userId: "text",
          created: "timestamp"
        },
        key : [ [ "queryId", "userId" ] ],
        indexes: ["id", "queryId"]
      });
      
      this._registerModel('Answer', {
        fields: {
          id: "uuid",
          queryUserId: "uuid",
          x : "float",
          y : "float",
          created: "timestamp"
        },
        key : [ [ "queryUserId" ], "created" ],
        indexes: ["queryUserId"],
        clustering_order: {"created": "desc"}
      });
      
      this._registerModel('Comment', {
        fields: {
          id: "uuid",
          isRootComment: "boolean",
          parentCommentId: "uuid",
          queryUserId: "uuid",
          queryId: "uuid",
          comment : "text",
          x : "float",
          y : "float",
          created: "timestamp"
        },
        key : [ [ "isRootComment" ], "queryId", "created" ],
        indexes: ["parentCommentId", "queryId", "id", "isRootComment"],
        clustering_order: {"created": "desc"}
      });
      
      this._registerModel('Session', {
        fields: {
          id: "uuid",
          userId: "text",
          queryUserId: "uuid",
          created: "timestamp"
        },
        key : ["id"]
      });
    }
    
    getModels() {
      return this._models;
    }
    
    getUuid() {
      return this.getModels().uuid();
    }
    
    toUuid(string) {
      return this.getModels().uuidFromString(string);
    }
    
    findSession(sessionId) {
      return this.getModels().instance.Session.findOneAsync({ id: sessionId });
    }
    
    findComment(commentId) {
      if (!commentId) {
        return Promise.resolve(null);
      }
      
      return this.getModels().instance.Comment.findOneAsync({ id: commentId });
    }
    
    listCommentsByParentCommentId(parentCommentId) {
      if (!parentCommentId) {
        return Promise.resolve([]);
      }
      
      return this.getModels().instance.Comment.findAsync({ parentCommentId: parentCommentId });
    }
    
    listRootCommentsByQueryId(queryId) {
      if (!queryId) {
        return Promise.resolve([]);
      }
      
      return this.getModels().instance.Comment.findAsync({ isRootComment: true, queryId: queryId });
    }
    
    findQueryUserBySession(sessionId) {
      return new Promise((resolve, reject) => {
        this.findSession(sessionId)
          .then((session) => {
            if (session) {
              this.findQueryUser(session.queryUserId)
                .then(resolve)
                .catch(reject);
            } else {
              resolve(null);
            } 
          })
          .catch(reject);
      });
    }
    
    listQueriesCurrentlyInProgress() {
      const now = new Date();
      return this.getModels().instance.Query.findAsync({ start : { '$lte': now }, end : { '$gte': now } }, { allow_filtering: true });
    }
    
    listQueryUsersByQueryId(queryId) {
      return this.getModels().instance.QueryUser.findAsync({ queryId: queryId });
    }
    
    listPeerQueryUsersBySessionId(sessionId) {
      return new Promise((resolve, reject) => {
        this.findQueryUserBySession(sessionId)
          .then((queryUser) => {
            if (queryUser) {
              this.listQueryUsersByQueryId(queryUser.queryId)
                .then((queryUsers) => {
                  resolve(queryUsers);
                })
                .catch(reject);
            } else {
              resolve(null);
            } 
          })
          .catch(reject);
      });
    }
    
    findLatestAnswerByQueryUserAndCreated(queryUserId, created) {
      return this.getModels().instance.Answer.findOneAsync({ queryUserId: queryUserId, created : { '$lte': created }, $limit: 1 });
    }
   
    findQueryUser(queryUserId) {
      return this.getModels().instance.QueryUser.findOneAsync({ id: queryUserId });
    }
    
    get instance() {
      return this.getModels().instance;
    }
    
    registerModels (callback) {
      async.parallel(this._createModelLoads(), (models) => {
        callback(models);
      });
    }
    
    _createModelLoads () {
      return _.map(this._registeredModels, (registeredModel) => {
        return (callback) => {
          this._models.loadSchema(registeredModel.modelName, registeredModel.modelSchema, callback);
        };
      });
    }
    
    _registerModel (modelName, modelSchema) {
      this._registeredModels.push({
        modelName: modelName,
        modelSchema: modelSchema
      });
    }
  } 
  
  module.exports = (options, imports, register) => {
    const cassandraModels = imports['shady-cassandra'];
    const liveDelphiModels = new LiveDelphiModels(cassandraModels);
    
    liveDelphiModels.registerModels((models) => {
      register(null, {
        'live-delphi-models': liveDelphiModels
      });
    });
  };
  
})();