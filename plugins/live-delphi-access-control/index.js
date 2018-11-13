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

    /**
     * Decodes json web token
     * 
     * @param {object} rptTokenResponse token response object
     * @returns decoded json web token
     */
    static decodeRptToken(rptTokenResponse) {
      const rptToken = JSON.parse(rptTokenResponse).access_token;
      const rpt = jwt.decode(rptToken);
      const permissions = [];
      (rpt.authorization.permissions || []).forEach(p => permissions.push({
        scopes: p.scopes,
        resource: p.rsname
      }));
      return {
        userName: rpt.preferred_username,
        roles: rpt.realm_access.roles,
        permissions: permissions
      };
    }

    /**
     * Creates protect resource middleware
     * 
     * @param {object} options options
     * @returns connect middleware function
     */
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
    
    /**
     * Checks if accesstoken has given resource permission with given scope
     * 
     * @param {object} accessToken accessToken
     * @param {int} id resource id
     * @param {string} type resource type
     * @param {array} scopes scopes
     * @returns promise which resolves if access token has given permissions
     */
    hasResourcePermission(accessToken, id, type, scopes) {
      const resource = `${type}:${id}`;
      return this.checkEntitlementRequest(resource, scopes, accessToken);
    }
    
    /**
     * Gets entitlements by access token
     * 
     * @param {object} accessToken access token
     * @returns decoded jwt token containing given entitlements
     */
    getEntitlements(accessToken) {
      const options = {
        url: this.getEntitlementUrl(),
        headers: {
            Accept: 'application/x-www-form-urlencoded'
        },
        auth: {
            bearer: accessToken.token
        },
        form: {
          grant_type: "urn:ietf:params:oauth:grant-type:uma-ticket",
          client_id: config.get("keycloak:resource"),
          audience: config.get("keycloak:resource"),
          response_include_resource_name: true
        },
        method: 'POST'
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
    
    /**
     * Checks ig accesstoken has entitlements to given resource
     * 
     * @param {string} resource resource name
     * @param {array} scopes list of scopes
     * @param {object} accessToken accesstoken
     * @returns promise which resolves if access token has given permissions
     */
    checkEntitlementRequest(resource, scopes, accessToken) {

      const scopeString = Array.isArray(scopes) ? scopes.join(",") : scopes; 

      const options = {
        url: this.getEntitlementUrl(),
        headers: {
            Accept: 'application/x-www-form-urlencoded'
        },
        auth: {
            bearer: accessToken.token
        },
        form: {
          grant_type: "urn:ietf:params:oauth:grant-type:uma-ticket",
          client_id: config.get("keycloak:resource"),
          audience: config.get("keycloak:resource"),
          permission: `${resource}#${scopeString}`
        },
        method: 'POST'
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
    
    /**
     * Creates connect middleware which requires user to be logged in
     * 
     * @returns middleware function
     */
    requireLoggedIn() {
      return [this.keycloak.protect(), this.createLoggedUserMiddleware()];
    }
    
    /**
     * Creates connect middleware which requires user to be logged in
     * 
     * @returns middleware function
     */
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
    
    /**
     * Gets accesstoken from request
     * 
     * @param {object} req express request
     * @returns access token
     */
    getAccessToken(req) {
      const kauth = req.kauth;
      if (kauth && kauth.grant && kauth.grant.access_token) {
        return kauth.grant.access_token;
      }
      
      return null;
    }
    
    /**
     * Gets user id from request
     * 
     * @param {object} req express request
     * @returns user id
     */
    getLoggedUserId(req) {
      const accessToken = this.getAccessToken(req);
      return accessToken && accessToken.content ? accessToken.content.sub : null;
    }

    /**
     * Returns url that can be used to check entitlements
     * 
     * @returns {String} entitlement url
     */
    getEntitlementUrl() {
      return`${config.get("keycloak:auth-server-url")}/realms/${config.get("keycloak:realm")}/protocol/openid-connect/token`;
    }
    
    /**
     * Registers access control class
     * 
     * @param {object} keycloak keycloak
     */
    register(keycloak) {
      this.keycloak = keycloak;
    }

  }

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const accessControl = new AccessControl(logger);
    register(null, {
      'live-delphi-access-control': accessControl
    });
  };

})();
