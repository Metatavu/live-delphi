/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const moment = require('moment');
  const uuid = require('uuid4');
  const config = require('nconf');
  const util = require('util');
  const request = require('request');
  
  class Routes {
    
    constructor (logger, models) {
      this.logger = logger;
      this.models = models;
    }
    
    getIndex(req, res) {
      res.render('index', Object.assign({ 

      }, req.liveDelphi));
    }
    
    getLogin(req, res) {
      res.redirect('/');
    }
    
    getQueries(req, res) {
      this.models.listQueriesCurrentlyInProgress()
        .then((queries) => {
          this.models.listEndedQueries()
            .then((endedQueries) => {
            res.render('queries/queries', Object.assign({ 
              queries: queries,
              endedQueries: endedQueries
            }, req.liveDelphi));
          });
        })
        .catch((err) => {
          this.logger.error(err);
          res.status(500).send(err);
        });
    }
    
    getLiveQuery(req, res) {
      const id = req.query.id;
      const userId = this.getLoggedUserId(req);
      
      this.models.findQuery(id)
        .then((query) => {
          this.models.createQueryUser(query.id, userId)
            .then((queryUser) => {
              this.models.createSession(userId, queryUser.id)
                .then((session) => {
                    res.render('queries/live', Object.assign({
                      sessionId: session.id,
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
      this.models.listQueriesByEditorUserId(this.getLoggedUserId(req))
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
      const labelx = req.body.labelx;
      const labely = req.body.labely;
      const type = '2D';
      
      if (start && end && name && thesis && labelx && labely) {
        this.models.createQuery(start, end, name, thesis, labelx, labely, type)
          .then((query) => {
            const editorUserMap = {};
            editorUserMap[this.getLoggedUserId(req)] = 'owner';

            this.models.setQueryEditorUserMap(query.id, editorUserMap)
              .then(() => {
                res.send(query);
              })
              .catch((sessionErr) => {
                this.logger.error(sessionErr);
                res.status(500).send(sessionErr);
              });
          })
          .catch((sessionErr) => {
            this.logger.error(sessionErr);
            res.status(500).send(sessionErr);
          });
      } else {
        res.status(500).send('Pakollisia kenttiä ovat nimi, teesi, X-akselin nimi, Y-Akselin nimi, alkuaika ja loppuaika. Täytä kaikki pakolliset kentät.');
      }
      
    }
    
    getEditQuery(req, res) {
      const id = req.query.id;
      
      this.models.findQuery(id)
        .then((query) => {
          if (!query) {
            res.status(404).send("Not Found");
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
      
      this.models.findQuery(id)
        .then((query) => {
          if (!query) {
            res.status(404).send("Not Found");
            return;
          }
          
          this.models.updateQuery(query.id, start, end, name, thesis, type)
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
      
      this.models.findQuery(id)
        .then((query) => {
          if (!query) {
            res.status(404).send("Not Found");
            return;
          }
          
          this.models.deleteQuery(query.id)
            .then(() => {
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
    
    postJoinQuery(req, res) {
      const queryId = req.params.queryId;
      const sessionId = req.body.sessionId;
          
      // TODO: Check if user has permission to join query
      // TODO: Check if query exists
      
      this.models.findSession(sessionId)
        .then((session) => {
          if (!session) {
            res.status(403).send();
            return;
          }
          
          const userId = session.userId;
          
          this.models.findQueryUserByQueryIdAndUserId(queryId, userId)
            .then((queryUser) => {
              if (queryUser) {
                return this.models.updateSessionQueryUserId(session.id, queryUser.id);
              } else {
                return this.models.createQueryUser(queryId, userId)
                  .then((queryUser) => {
                    return this.models.updateSessionQueryUserId(session.id, queryUser.id);
                  });
              }
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
    
    join(req, res) {
      const keycloakServerUrl = config.get('keycloak:auth-server-url');
      const keycloakRealm = config.get('keycloak:realm');
      const keycloakUrl = util.format('%s/realms/%s/protocol/openid-connect/userinfo', keycloakServerUrl, keycloakRealm);
      
      request.get(keycloakUrl, {
        'auth': {
          'bearer': req.body.token
        }
      }, (authErr, response, body) => {
        if (authErr) {
          // TODO: Better error handling
          this.logger.error(authErr);
          res.status(403).send(authErr);
        } else {
          const reponse = JSON.parse(body);
          const userId = reponse.sub;
          
          this.models.createSession(userId)
            .then((session) => {
              res.send({
                sessionId: session.id
              });
            })
            .catch((sessionErr) => {
              logger.error(sessionErr);
              res.status(500).send(sessionErr);
            });
        }
      });
    }
    
    getQueryPlayback(req, res) {
      const queryId = req.query.id;
      const userId = this.getLoggedUserId(req);
      
      this.models.findQuery(queryId)
        .then((query) => {
          this.models.createQueryUser(query.id, userId)
            .then((queryUser) => {
              this.models.createSession(userId, queryUser.id)
                .then((session) => {
                  res.render('queries/playback', Object.assign({
                    sessionId: session.id,
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
    
    getQueryCommentPlayback(req, res) {
      const queryId = req.query.id;
      const userId = this.getLoggedUserId(req);
      
      this.models.findQuery(queryId)
        .then((query) => {
          this.models.createQueryUser(query.id, userId)
            .then((queryUser) => {
              this.models.createSession(userId, queryUser.id)
                .then((session) => {
                  res.render('queries/comment-playback', Object.assign({
                    sessionId: session.id,
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
    
    getKeycloakJson(req, res) {
      res.header('Content-Type', 'application/json');
      res.send(config.get('keycloak'));
    }
    
    register(app, keycloak) {
      // Navigation
     
      app.get("/", this.getIndex.bind(this));
      app.get("/login", keycloak.protect(), this.getLogin.bind(this)); 
    
      app.post('/joinQuery/:queryId', this.postJoinQuery.bind(this));
    
      // Live query
    
      app.get("/queries", this.getQueries.bind(this));
      app.get("/queries/live", this.getLiveQuery.bind(this));
      
      // Query playback
      app.get("/queries/playback", this.getQueryPlayback.bind(this));
      
      app.get("/queries/comment-playback", this.getQueryCommentPlayback.bind(this));
      
      // Query management
    
      app.get("/manage/queries", [ keycloak.protect(), this.loggedUserMiddleware.bind(this) ], this.getManageQueries.bind(this));
      app.get("/manage/queries/create", keycloak.protect(), this.getCreateQuery.bind(this));
      app.post("/manage/queries/create", [ keycloak.protect(), this.loggedUserMiddleware.bind(this) ], this.postCreateQuery.bind(this));
      app.get("/manage/queries/edit", [ keycloak.protect(), this.loggedUserMiddleware.bind(this), this.requireQueryOwner.bind(this) ], this.getEditQuery.bind(this));
      app.put("/manage/queries/edit", [ keycloak.protect(), this.loggedUserMiddleware.bind(this), this.requireQueryOwner.bind(this) ], this.putEditQuery.bind(this));
      app.delete("/manage/queries/delete", [ keycloak.protect(), this.loggedUserMiddleware.bind(this), this.requireQueryOwner.bind(this) ], this.deleteQuery.bind(this));
      
      app.post('/join', this.join.bind(this));
      app.get('/keycloak.json', this.getKeycloakJson.bind(this));
    }
    
    isQueryOwner(queryId, userId) {
      return this.models.findQueryEditorByQueryIdUserId(queryId, userId)
        .then((queryEditor) => {
          return queryEditor && queryEditor.role === 'owner';
        });
    }
    
    requireQueryOwner(req, res, next) {
      const id = req.body.id || req.query.id;
      const userId = this.getLoggedUserId(req);
      
      this.isQueryOwner(id, userId)
        .then((isQueryOwner) => {
          if (!isQueryOwner) {
            res.status(403).send("Forbidden");
          } else {
            next();
          }
        })
        .catch((err) => {
          this.logger.error(err);
          res.status(500).send(err);
        });
    }
    
    loggedUserMiddleware(req, res, next) {
      const userId = this.getLoggedUserId(req);
      if (userId) {
        next();
      } else {
        this.logger.error(authErr);
        res.status(403).send(authErr);
      }
    }
    
    getLoggedUserId(req) {
      const kauth = req.kauth;
      if (kauth && kauth.grant && kauth.grant.access_token && kauth.grant.access_token.content) {
        return kauth.grant.access_token.content.sub;
      }
      
      return null;
    }
    
  };

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const models = imports['live-delphi-models'];
    const routes = new Routes(logger, models);
    register(null, {
      'live-delphi-routes': routes
    });
  };

})();
