/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const util = require('util'); 
  const config = require('nconf');
  const _ = require('lodash');
  const crypto = require('crypto');
  const KeycloakAdminClient = require('keycloak-admin-client');
  const Promise = require('bluebird');
  
  class ResourceManagement {
    
    constructor (logger) {
      this.logger = logger;
      this.client = null;
      this.requireFreshClient = true;
      this.realm = config.get('keycloak:realm');
      setInterval(() => {
        this.requireFreshClient = true;
      }, 45 * 1000);
    }
    
    createResource(clientId, resourceName, resourceType, scopes) {
      const resource = {
        "scopes": scopes || [],
        "name": resourceName,
        "type": resourceType
      };
      
      return this.getClient()
        .then((client) => {
          return client.clients.authorizations.resources.create(this.realm, clientId, resource);
        });
    }
    
    createPolicy(clientId, policyName, policyDescription, users) {
      const policy = {
        "type":"user",
        "logic":"POSITIVE",
        "name": policyName,
        "description": policyDescription,
        "users": users
      };
      
      return this.getClient()
        .then((client) => {
          return client.clients.authorizations.policies.create(this.realm, clientId, policy);
        });
    }
    
    createPermission(clientId, permissionName, resources, policies) {
      const permission = {
        "type":"resource",
        "logic":"POSITIVE",
        "decisionStrategy":"UNANIMOUS",
        "name": permissionName,
        "resources": resources,
        "policies": policies
      };
      
      return this.getClient()
        .then((client) => {
          return client.clients.authorizations.permissions.create(this.realm, clientId, permission);
        });
    }
    
    getClient() {
      if (!this.client || this.requireFreshClient) {
        this.client = KeycloakAdminClient(config.get('keycloak:admin'));
        this.requireFreshClient = false;
      }
      
      return this.client;
    }
  };

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const resourceManagement = new ResourceManagement(logger);
    register(null, {
      'live-delphi-resource-management': resourceManagement
    });
  };

})();
