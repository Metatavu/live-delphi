/* jshint esversion: 6 */
/* global __dirname */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const async = require('async');
  const util = require('util');
  
  class LiveDelphiModels {
    
    constructor (models) {
      this._models = models;
      this._registeredModels = [];
      
      this._registerModel('Answer', {
        fields: {
          id: "uuid",
          x : "float",
          y : "float",
          created: "timestamp"
        },
        key : ["id"]
      });
      
      this._registerModel('Session', {
        fields: {
          id: "uuid",
          userId: "text",
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