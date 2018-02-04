/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';

  const config = require('nconf');
  const _ = require('lodash');
  const Promise = require('bluebird');
  const request = require('request');
  const jwt = require('jsonwebtoken');
  
  class AccessControl {
    
    constructor (logger) {
      this.logger = logger;
      this.keycloak = null;
    }

    static decodeRptToken(rptTokenResponse) {
      const rptToken = JSON.parse(rptTokenResponse).rpt;
      const rpt = jwt.decode(rptToken);
      let permissions = [];
      (rpt.authorization.permissions || []).forEach(p => permissions.push({
        scopes: p.scopes,
        resource: p.resource_set_name
      }));
      return {
        userName: rpt.preferred_username,
        roles: rpt.realm_access.roles,
        permissions: permissions
      };
    }

    protectResourceMiddleware(options) {
      const result = [this.keycloak.protect(), this.createLoggedUserMiddleware()];
      result.push((req, res, next) => {
        let id = null;
        
        const idOptions = options.id;
        switch (idOptions.from) {
          case 'path':
            id = req.params[idOptions.name];
          break;
          case 'query':
            id = req.query[idOptions.name];
          break;
          case 'body':
            id = req.body[idOptions.name];
          break;
        }
        
        this.hasResourcePermission(this.getAccessToken(req), id, options.type, options.scopes)
          .then(() => { next(); })
          .catch(error => {
            this.logger.error("Permission denied");
            res.status(403).send("Permission denied");
          });
      });
         
      return result;
    }
    
    hasResourcePermission(accessToken, id, type, scopes) {
      const resource = `${type}:${id}`;
      return this.checkEntitlementRequest(resource, scopes, accessToken);
    }
    
    getEntitlements(accessToken) {
      let options = {
        url: this.getEntitlementUrl(),
        headers: {
          Accept: 'application/json'
        },
        auth: {
          bearer: accessToken.token
        },
        method: 'GET'
      };

      return new Promise((resolve, reject) => {
        request(options, (error, response, body) =>  {
          if (error || response.statusCode !== 200) {
            reject(error);
          } else {
            resolve(AccessControl.decodeRptToken(body));
          }
        });
      });
    }
    
    checkEntitlementRequest(resource, scopes, accessToken) {

      let permission = {
        resource_set_name: resource,
        scopes: scopes
      };

      let jsonRequest = {
        permissions: [permission]
      };

      let options = {
        url: this.getEntitlementUrl(),
        headers: {
            Accept: 'application/json'
        },
        auth: {
            bearer: accessToken.token
        },
        body: jsonRequest,
        method: 'POST',
        json: true
      };

      return new Promise((resolve, reject) => {
        request(options, (error, response, body) =>  {
          if (error || response.statusCode !== 200) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    
    requireLoggedIn() {
      return [this.keycloak.protect(), this.createLoggedUserMiddleware()];
    }
    
    createLoggedUserMiddleware() {
      return (req, res, next) => {
        const userId = this.getLoggedUserId(req);
        if (userId) {
          next();
        } else {
          this.logger.error("User id not found");
          res.status(403).send("User id not found");
        }
      };
    }
    
    getAccessToken(req) {
      const kauth = req.kauth;
      if (kauth && kauth.grant && kauth.grant.access_token) {
        return kauth.grant.access_token;
      }
      
      return null;
    }
    
    getLoggedUserId(req) {
      const accessToken = this.getAccessToken(req);
      return accessToken && accessToken.content ? accessToken.content.sub : null;
    }

    getEntitlementUrl() {
        return `${this.keycloak.config.realmUrl}/authz/entitlement/${this.keycloak.config.clientId}`;
    }

    register(keycloak) {
      this.keycloak = keycloak;
    }

  };

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const accessControl = new AccessControl(logger);
    register(null, {
      'live-delphi-access-control': accessControl
    });
  };

})();
