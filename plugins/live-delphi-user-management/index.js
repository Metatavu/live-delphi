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
  
  class UserManagement {
    
    constructor (logger, models) {
      this.logger = logger;
      this.models = models;
      this.client = null;
      this.requireFreshClient = true;
      this.realm = config.get('keycloak:realm');
      setInterval(() => {
        this.requireFreshClient = true;
      }, 45 * 1000);
    }
    
    findUser(id) {
      return this.getClient()
        .then((client) => {
          return client.users.find(this.realm, { userId: id });
        });
    }
    
    listUsers() {
      return this.getClient()
        .then((client) => {
          return client.users.find(this.realm);
        });
    }
    
    listUserGroupIds(userId) {
      return new Promise((resolve, reject) => {
        this.listUserGroups(userId)
          .then((userGroup) => {
            resolve(_.uniq(_.map(userGroup, 'id')));
          })
          .catch(reject);
      });
    }
    
    listUserGroups(userId) {
      return this.getClient()
        .then((client) => {
          return client.users.groups.find(this.realm, userId);
        });
    }
    
    listGroups() {
      return this.getClient()
        .then((client) => {
          return client.groups.find(this.realm);
        });
    }
    
    listGroupsMemberIds(groupIds) {     
      return new Promise((resolve, reject) => {
        this.listGroupsMembers(groupIds)
          .then((members) => {
            resolve(_.uniq(_.map(members, 'id')));
          })
          .catch(reject);
      });
    }
    
    listGroupsMembers(groupIds) {
      return new Promise((resolve, reject) => {
        const promises = _.map(groupIds, (groupId) => {
          return this.listGroupMembers(groupId);
        });

        Promise.all(promises)
          .then((results) => {
            resolve(_.compact(_.flatten(results)));
          })
          .catch(reject);
      });
    }
    
    listGroupMembers(groupId) {
      return new Promise((resolve, reject) => {
        this.getClient()
          .then((client) => {
            client.groups.members.find(this.realm, groupId)
              .then(resolve)
              .catch((err) => {
                resolve([]);
              });
          })
          .catch();
      });
    }
    
    getUserDisplayName(user) {
      const attributes = {};

      _.forEach(user.attributes||{}, (originalValue, key) => {
        const value = _.isArray(originalValue) ? originalValue.join('') : originalValue;
        attributes[String(key).toLowerCase()] = value;
      });

      const name = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName ;
      
      if (name) {
        return name;
      }
      
      return `<${user.email}>`;
    }
    
    isValidUserId(userId) {
      if (typeof userId === 'string') {
        return !!userId.match(/[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}$/);
      }
      
      return false;
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
    const models = imports['live-delphi-models'];
    const userManagement = new UserManagement(logger, models);
    register(null, {
      'live-delphi-user-management': userManagement
    });
  };

})();
