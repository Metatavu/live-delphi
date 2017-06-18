/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const moment = require('moment');
  const uuid = require('uuid4');
  const config = require('nconf');
  const request = require('request');
  
  class Routes {
    
    constructor (logger, liveDelphiModels) {
      this.logger = logger;
      this.liveDelphiModels = liveDelphiModels;
    }
    
    getIndex(req, res) {
      res.render('index', Object.assign({ 

      }, req.liveDelphi));
    }
    
    getLogin(req, res) {
      res.redirect('/');
    }
    
    getQueries(req, res) {
      this.liveDelphiModels.listQueriesCurrentlyInProgress()
        .then((queries) => {
          res.render('queries/queries', Object.assign({ 
            queries: queries
          }, req.liveDelphi));
        })
        .catch((err) => {
          this.logger.error(err);
          res.status(500).send(err);
        });
    }
    
    getLiveQuery(req, res) {
      const id = req.query.id;
      
      // TODO: Logged user id?
      
      const queryUserId = this.liveDelphiModels.getUuid();
      const sessionId = this.liveDelphiModels.getUuid();
      const userId = "ANON-" + uuid();
      
      this.liveDelphiModels.findQuery(this.liveDelphiModels.toUuid(id))
        .then((query) => {
          this.liveDelphiModels.createQueryUser(queryUserId, query.id, userId)
            .then((queryUser) => {
              this.liveDelphiModels.createSession(sessionId, userId, queryUserId)
                .then((session) => {
                    res.render('queries/live', Object.assign({
                      sessionId: sessionId,
                      query: query
                    }, req.liveDelphi));
                })
                .catch((err) => {
                  this.logger.error(err);
                  res.status(500).send(err);
                });
            });
        })
        .catch((err) => {
          this.logger.error(err);
          res.status(500).send(err);
        });
    }
    
    getCreateQuery(req, res) {
      res.render('queries/create', Object.assign({ 

      }, req.liveDelphi));
    }
    
    getManageQueries(req, res) {
      this.liveDelphiModels.listQueriesByOwnerUserId(req.liveDelphi.user.sub)
        .then((queries) => {
          res.render('queries/manage', Object.assign({ 
            queries: queries
          }, req.liveDelphi));
        })
        .catch((err) => {
          this.logger.error(err);
          res.status(500).send(err);
        });
    }
    
    postCreateQuery(req, res) {
      const start = req.body.start;
      const end = req.body.end;
      const name = req.body.name;
      const thesis = req.body.thesis;
      const type = '2D';
      
      this.liveDelphiModels.createQuery(start, end, name, thesis, type, [ req.liveDelphi.user.sub ])
        .then((query) => {
          res.send(query);
        })
        .catch((sessionErr) => {
          this.logger.error(sessionErr);
          res.status(500).send(sessionErr);
        });
    }
    
    getEditQuery(req, res) {
      const id = req.query.id;
      
      this.liveDelphiModels.findQuery(this.liveDelphiModels.toUuid(id))
        .then((query) => {
          if (!this.isQueryOwner(query, req.liveDelphi.user.sub)) {
            res.status(403).send("Forbidden");
            return;
          }
          
          const start = query.start ? moment(query.start).valueOf() : null;
          const end = query.end ? moment(query.end).valueOf() : null;
          
          res.render('queries/edit', Object.assign({
            query: query,
            start: start,
            end: end
          }, req.liveDelphi));
        })
        .catch((err) => {
          this.logger.error(err);
          res.status(500).send(err);
        });
    }
    
    putEditQuery(req, res) {
      const start = new Date(parseInt(req.body.start));
      const end = new Date(parseInt(req.body.end));
      const name = req.body.name;
      const thesis = req.body.thesis;
      const type = '2D';
      const id = req.body.id;
      
      this.liveDelphiModels.findQuery(this.liveDelphiModels.toUuid(id))
        .then((query) => {
          if (!this.isQueryOwner(query, req.liveDelphi.user.sub)) {
            res.status(403).send("Forbidden");
            return;
          }
          
          this.liveDelphiModels.updateQuery(query, start, end, name, thesis, type)
          .then((query) => {
            res.send(query);
          })
          .catch((err) => {
            this.logger.error(err);
            res.status(500).send(err);
          });
        })
        .catch((err) => {
          this.logger.error(err);
          res.status(500).send(err);
        });
    }
    
    deleteQuery(req, res) {
      const id = req.query.id;
      
      this.liveDelphiModels.findQuery(this.liveDelphiModels.toUuid(id))
        .then((query) => {
          if (!this.isQueryOwner(query, req.liveDelphi.user.sub)) {
            res.status(403).send("Forbidden");
            return;
          }
          
          this.liveDelphiModels.deleteQuery(query)
          .then((query) => {
            res.status(204).send();
          })
          .catch((err) => {
            this.logger.error(err);
            res.status(500).send(err);
          });
        })
        .catch((err) => {
          this.logger.error(err);
          res.status(500).send(err);
        });
    }
    
    register(app, keycloak) {
      // Navigation
     
      app.get("/", this.getIndex.bind(this));
      app.get("/login", keycloak.protect(), this.getLogin.bind(this));
    
      // Live query
    
      app.get("/queries", this.getQueries.bind(this));
      app.get("/queries/live", this.getLiveQuery.bind(this));
      
      // Query management
    
      app.get("/manage/queries", [ keycloak.protect(), this.loggedUserMiddleware.bind(this) ], this.getManageQueries.bind(this));
      app.get("/manage/queries/create", keycloak.protect(), this.getCreateQuery.bind(this));
      app.post("/manage/queries/create", [ keycloak.protect(), this.loggedUserMiddleware.bind(this) ], this.postCreateQuery.bind(this));
      app.get("/manage/queries/edit", [ keycloak.protect(), this.loggedUserMiddleware.bind(this) ], this.getEditQuery.bind(this));
      app.put("/manage/queries/edit", [ keycloak.protect(), this.loggedUserMiddleware.bind(this) ], this.putEditQuery.bind(this));
      app.delete("/manage/queries/delete", [ keycloak.protect(), this.loggedUserMiddleware.bind(this) ], this.deleteQuery.bind(this));
    }
    
    isQueryOwner(query, userId) {
      return query.ownerUserIds.indexOf(userId) !== -1;
    }
    
    loggedUserMiddleware(req, res, next) {
      const keycloakServerUrl = config.get('keycloak:auth-server-url');
      const keycloakRealm = config.get('keycloak:realm');
      const keycloakUrl = `${keycloakServerUrl}/realms/${keycloakRealm}/protocol/openid-connect/userinfo`;
      const token = req.kauth.grant['access_token'].token;
      
      request.get(keycloakUrl, {
        'auth': {
          'bearer': token
        }
      }, (authErr, response, body) => {
        if (authErr) {
          this.logger.error(authErr);
          res.status(403).send(authErr);
        } else {
          const reponse = JSON.parse(body);
          req.liveDelphi.user = reponse;
          next();
        }
      });
    }
    
  };

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const liveDelphiModels = imports['live-delphi-models'];
    const routes = new Routes(logger, liveDelphiModels);
    register(null, {
      'live-delphi-routes': routes
    });
  };

})();
