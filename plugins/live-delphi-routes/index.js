/*jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const moment = require('moment');
  
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
    
    getCreateQuery(req, res) {
      res.render('queries/create', Object.assign({ 

      }, req.liveDelphi));
    }
    
    getQueries(req, res) {
      this.liveDelphiModels.listQueries()
        .then((queries) => {
          res.render('queries/index', Object.assign({ 
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
      
      this.liveDelphiModels.createQuery(start, end, name, thesis, type)
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
    
      // Query management
    
      app.get("/manage/queries", keycloak.protect(), this.getQueries.bind(this));
      app.get("/manage/queries/create", keycloak.protect(), this.getCreateQuery.bind(this));
      app.post("/manage/queries/create", keycloak.protect(), this.postCreateQuery.bind(this));
      app.get("/manage/queries/edit", keycloak.protect(), this.getEditQuery.bind(this));
      app.put("/manage/queries/edit", keycloak.protect(), this.putEditQuery.bind(this));
      app.delete("/manage/queries/delete", keycloak.protect(), this.deleteQuery.bind(this));
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
