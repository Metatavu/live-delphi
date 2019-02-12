/* jshint esversion: 6 */
/* global __dirname */

(() => {
  'use strict';
  
  const moment = require('moment');
  const uuid = require('uuid4');
  const config = require('nconf');
  const util = require('util');
  const request = require('request');
  const _ = require('lodash');
  const Promise = require('bluebird');
  const Hashes = require('jshashes');
  const SHA256 = new Hashes.SHA256();
  const path = require('path');
  const pug = require('pug');
  
  //TODO: move somewhere else
  class ResourceType {
    static get FOLDER() {
      return "folder";
    }
    
    static get QUERY() {
      return "query";
    }
  }
  
  class Routes {

    constructor (logger, models, dataExport, resourceManagement, charts, analysis, pdf) {
      this.logger = logger;
      this.models = models;
      this.dataExport = dataExport;
      this.resourceManagement = resourceManagement;
      this.charts = charts;
      this.analysis = analysis;
      this.pdf = pdf;
    }
    
    getIndex(req, res) {
      res.render('index', Object.assign({ 

      }, req.liveDelphi));
    }
    
    getLogin(req, res) {
      res.redirect('/');
    }
    
    async getQueries(req, res) {
      try {
        const result = [];
        const unFolderedQueries = await this.models.listUnFolderedQueriesCurrentlyInProgress();
        if (unFolderedQueries.length) {
          result.push({
            name: 'Ei kansiota',
            queries: unFolderedQueries
          });
        }
        const accessCodes = req.query.accessCodes ? req.query.accessCodes.split(',') : []; 
        const queryFolders = await this.models.listQueryFoldersByAccessCodes([null].concat(accessCodes));
        
        const folderedQueryPromises = [];
        const folderIds = [null];
        
        queryFolders.forEach((queryFolder) => { 
          folderedQueryPromises.push(this.models.listQueriesCurrentlyInProgressByFolderId(queryFolder.id));
          folderIds.push(queryFolder.id);
        });
        const folderedQueries = await Promise.all(folderedQueryPromises);
        
        queryFolders.forEach((queryFolder, index) => {
          if (folderedQueries[index].length > 0) {
            result.push(Object.assign(queryFolder, {queries: folderedQueries[index]}));
          }
        });
        const endedQueries = await this.models.listEndedQueriesByFolderIds(folderIds);
        res.render('queries/queries', Object.assign({ 
          folders: result,
          endedQueries: endedQueries,
          accessCodes: accessCodes.join(',')
        }, req.liveDelphi));
        
      } catch (err) {
        console.error(err);
        res.status(500).send(err);
      }
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
                  console.error(err);
                  res.status(500).send(err);
                });
            });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send(err);
        });
    }
    
    getQueryLiveComments(req, res) {
      const id = req.query.id;
      const userId = this.getLoggedUserId(req);

      this.models.findQuery(id)
        .then((query) => {
          this.models.createQueryUser(query.id, userId)
            .then((queryUser) => {
              this.models.createSession(userId, queryUser.id)
                .then((session) => {
                    res.render('queries/live-comments', Object.assign({
                      sessionId: session.id,
                      query: query
                    }, req.liveDelphi));
                })
                .catch((err) => {
                  console.error(err);
                  res.status(500).send(err);
                });
            });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send(err);
        });
    }
    
    async getCreateQuery(req, res) {
      try {
        const entitlements = await this.accessControl.getEntitlements(this.accessControl.getAccessToken(req));
        const folderIds = this.getAllowedResourceIdsWIthType(entitlements, ResourceType.FOLDER);
        const queryFolders = await this.models.listQueryFoldersByIds(folderIds);
        res.render('queries/create', Object.assign({ 
          queryFolders: queryFolders
        }, req.liveDelphi));
      } catch (err) {
        this.handleError(req, res, err);
      }
    }
    
    async getManageQueryFolders(req, res) {
      try {
        const entitlements = await this.accessControl.getEntitlements(this.accessControl.getAccessToken(req));
        const folderIds = this.getAllowedResourceIdsWIthType(entitlements, ResourceType.FOLDER);
        const queryFolders = await this.models.listQueryFoldersByIds(folderIds);
        res.render('folders/manage', Object.assign({ 
          queryFolders: queryFolders
        }, req.liveDelphi));
      } catch (err) {
        this.handleError(req, res, err);
      }
    }
    
    async postCreateQueryFolder(req, res) {
      try {
        const name = req.body.name;
        const accessCode = req.body.accessCode;
        const userId = this.getLoggedUserId(req);

        if (name && userId) {
          const queryFolder = await this.models.createQueryFolder(name, userId, accessCode);
          const resourceName = `${ResourceType.FOLDER}:${queryFolder.id}`;
          const queryFolderResource = await this.resourceManagement.createResource(config.get('keycloak:admin:clientId'), resourceName, ResourceType.FOLDER, []); 
          const queryFolderPolicy = await this.resourceManagement.createPolicy(config.get('keycloak:admin:clientId'), `${resourceName}-policy`, name, [userId]);
          const queryFolderPermission = await this.resourceManagement.createPermission(config.get('keycloak:admin:clientId'), `${resourceName}-permission`, [queryFolderResource._id], [queryFolderPolicy.id]);
          
          res.send(queryFolder);
        } else {
          res.status(500).send('Pakollisia kenttiä ovat nimi ja käyttäjä. Täytä kaikki pakolliset kentät.');
        }
      } catch (err) {
        console.error(err);
        res.status(500).send(err);
      }
    } 
    
    async getManageQueries(req, res) {
      try {
        const entitlements = await this.accessControl.getEntitlements(this.accessControl.getAccessToken(req));
        const queryIds = this.getAllowedResourceIdsWIthType(entitlements, ResourceType.QUERY);

        this.models.listQueriesByIds(queryIds)
          .then((queries) => {
            res.render('queries/manage', Object.assign({ 
              queries: queries
            }, req.liveDelphi));
          })
          .catch((err) => {
            console.error(err);
            res.status(500).send(err);
          });
      } catch (err) {
        console.error(err);
        res.status(500).send(err);
      }
    }
    
    async postCreateQuery(req, res) {
      try {
        const userId = this.getLoggedUserId(req);
        const folderId = req.body.folderId || null;
        const start = req.body.start;
        const end = req.body.end;
        const name = req.body.name;
        const thesis = req.body.thesis;
        const labelx = req.body.labelx;
        const labely = req.body.labely;
        const colorx = req.body.colorx;
        const colory = req.body.colory;
        const segment1Background = req.body.segment1Background;
        const segment2Background = req.body.segment2Background;
        const segment3Background = req.body.segment3Background;
        const segment4Background = req.body.segment4Background;
        const type = '2D';

        if (start && end && name && thesis && labelx && labely) {
          const query = await this.models.createQuery(start, end, name, thesis, labelx, labely, colorx, colory, segment1Background, segment2Background, segment3Background, segment4Background, type);
          const resourceName = `${ResourceType.QUERY}:${query.id}`;
          const queryResource = await this.resourceManagement.createResource(config.get('keycloak:admin:clientId'), resourceName, ResourceType.QUERY, []);
          const queryPolicy = await this.resourceManagement.createPolicy(config.get('keycloak:admin:clientId'), `${resourceName}-policy`, name, [userId]);
          const queryPermission = await this.resourceManagement.createPermission(config.get('keycloak:admin:clientId'), `${resourceName}-permission`, [queryResource._id], [queryPolicy.id]);
          res.send(query);
        } else {
          res.status(500).send('Pakollisia kenttiä ovat nimi, teesi, X-akselin nimi, Y-Akselin nimi, alkuaika ja loppuaika. Täytä kaikki pakolliset kentät.');
        }
      } catch (err) {
        console.error(err);
        res.status(500).send(err);
      }
      
    }
    
    async getEditQuery(req, res) {
      try {
        const id = req.query.id;
        const entitlements = await this.accessControl.getEntitlements(this.accessControl.getAccessToken(req));
        const folderIds = this.getAllowedResourceIdsWIthType(entitlements, ResourceType.FOLDER);
        const queryFolders = await this.models.listQueryFoldersByIds(folderIds);
        const query = await this.models.findQuery(id)

        if (!query) {
          res.status(404).send("Not Found");
          return;
        }

        const start = query.start ? moment(query.start).valueOf() : null;
        const end = query.end ? moment(query.end).valueOf() : null;

        res.render('queries/edit', Object.assign({
          query: query,
          start: start,
          end: end,
          queryFolders: queryFolders
        }, req.liveDelphi));

      } catch (err) {
        console.error(err);
        res.status(500).send(err);
      }
    }
    
    putEditQuery(req, res) {
      const folderId = req.body.folderId || null;
      const start = new Date(parseInt(req.body.start));
      const end = new Date(parseInt(req.body.end));
      const name = req.body.name;
      const thesis = req.body.thesis;
      const type = '2D';
      const id = req.body.id;
      const labelx = req.body.labelx;
      const labely = req.body.labely;
      const colorx = req.body.colorx;
      const colory = req.body.colory;
      const segment1Background = req.body.segment1Background;
      const segment2Background = req.body.segment2Background;
      const segment3Background = req.body.segment3Background;
      const segment4Background = req.body.segment4Background;
      
      this.models.findQuery(id)
        .then((query) => {
          if (!query) {
            res.status(404).send("Not Found");
            return;
          }
          
          this.models.updateQuery(query.id, start, end, name, thesis, type, labelx, labely, colorx, colory, segment1Background, segment2Background, segment3Background, segment4Background, folderId)
          .then((query) => {
            res.send(query);
          })
          .catch((err) => {
            console.error(err);
            res.status(500).send(err);
          });
        })
        .catch((err) => {
          console.error(err);
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
              console.error(err);
              res.status(500).send(err);
            });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send(err);
        });
    }
    
    deleteQueryData(req, res) {
      const id = req.query.id;
      
      this.models.findQuery(id)
        .then((query) => {
          if (!query) {
            res.status(404).send("Not Found");
            return;
          }
          
          this.models.deleteQueryData(query.id)
            .then(() => {
              res.status(204).send();
            })
            .catch((err) => {
              console.error(err);
              res.status(500).send(err);
            });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send(err);
        });
    }
    
    getExportQueryLatestAnswers(req, res) {
      const queryId = req.query.id;
      if (!queryId) {
        res.status(400).send('Missing id parameter');
      }
      
      const format = req.query.format;
      
      switch (format) {
        case 'excel':
          this.dataExport.exportQueryLatestAnswerDataAsXLSX(queryId)
            .then((exportData) => {
              res.setHeader('content-type', exportData.contentType);
              res.setHeader('Content-disposition', `attachment; filename=${exportData.filename}`);    
              res.send(exportData.buffer);
            })
            .catch((err) => {
              res.status(err.code || 500).send(err.message || 'Internal server error');
            });
        break;
        default:
          res.status(400).send(`Unknown format '${format}'`);
        break;
      }
    }
    
    getExportQueryAnswers(req, res) {
      const queryId = req.query.id;
      if (!queryId) {
        res.status(400).send('Missing id parameter');
      }
      
      const format = req.query.format;
      const includeTimes = req.query.includeTimes === 'true';
      
      switch (format) {
        case 'excel':
          const exportPromise = includeTimes 
            ? this.dataExport.exportQueryAnswerDataWithTimesAsXLSX(queryId) 
            : this.dataExport.exportQueryLatestAnswerDataAsXLSX(queryId);
          
          exportPromise.then((exportData) => {
            res.setHeader('content-type', exportData.contentType);
            res.setHeader('Content-disposition', `attachment; filename=${exportData.filename}`);    
            res.send(exportData.buffer);
          })
          .catch((err) => {
            res.status(err.code || 500).send(err.message || 'Internal server error');
          });
        break;
        default:
          res.status(400).send(`Unknown format '${format}'`);
        break;
      }
    }
    
    getExportQueryComments(req, res) {
      const queryId = req.query.id;
      const format = req.query.format;
      
      switch (format) {
        case 'excel':
          this.dataExport.exportQueryCommentsAsXLSX(queryId)
            .then((exportData) => {
              res.setHeader('content-type', exportData.contentType);
              res.setHeader('Content-disposition', `attachment; filename=${exportData.filename}`);    
              res.send(exportData.buffer);
            })
            .catch((err) => {
              res.status(err.code || 500).send(err.message || 'Internal server error');
            });
        break;
        default:
          res.status(400).send(`Unknown format '${format}'`);
        break;
      }
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
          
          if (!userId) {
            res.status(403).send();
            return;
          }
          
          return this.models.findQueryUserByQueryIdAndUserId(queryId, userId)
            .then((queryUser) => {
              if (queryUser) {
                return this.models.updateSessionQueryUserId(session.id, queryUser.id)
                  .then(() => {
                    return queryUser;
                  });
              } else {
                return this.models.createQueryUser(queryId, userId)
                  .then((queryUser) => {
                    return this.models.updateSessionQueryUserId(session.id, queryUser.id)
                      .then(() => {
                        return queryUser;
                      });
                  });
              }
            });
        })
        .then((queryUser) => {
          res.status(200).send({
            queryUserId: queryUser.id,
            userHash: SHA256.hex(queryUser.id.toString())
          });
        })
        .catch((err) => {
          console.error(err);
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
          console.error(authErr);
          res.status(403).send(authErr);
        } else {
          const userinfo = JSON.parse(body);
          const userId = userinfo.sub;
          
          this.models.createSession(userId)
            .then((session) => {
              res.send({
                sessionId: session.id
              });
            })
            .catch((sessionErr) => {
              console.error(sessionErr);
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
                  console.error(err);
                  res.status(500).send(err);
                });
            });
        })
        .catch((err) => {
          console.error(err);
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
                  console.error(err);
                  res.status(500).send(err);
                });
            });
        })
        .catch((err) => {
          console.error(err);
          res.status(500).send(err);
        });
    }
    
    getKeycloakJson(req, res) {      
      res.header('Content-Type', 'application/json');
      res.send({
        "realm": config.get('keycloak:browser:realm'),
        "auth-server-url": config.get('keycloak:browser:auth-server-url'),
        "ssl-required": config.get('keycloak:browser:ssl-required'),
        "resource": config.get('keycloak:browser:resource'),
        "public-client": config.get('keycloak:browser:public-client')
      });       
    }

    /**
     * Renders 2d query as scatter report
     * 
     * @param {Object} req http request
     * @param {Object} res http response
     */
    /* jshint ignore:start */
    async getPrintQueryReportsScatter2d(req, res) {
      const queryId = req.query.id;
      const format = req.query.format;
      
      try {
        const query = await this.models.findQuery(queryId);
        const queryScale2dData = await this.dataExport.exportQueryLatestAnswerDataAsQueryData(query);
        const analysis = await this.analysis.analyzeScale2d(queryScale2dData);
        const renderOptions = Object.assign({
          query: query,
          analysis: analysis
        }, req.liveDelphi);
        
        const compiledPug = pug.compileFile(`${__dirname}/../../views/reports/scatter2d.pug`);
        const html = compiledPug(renderOptions);

        if (format === 'PDF') {
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const pdfStream = await this.pdf.renderPdf(html, baseUrl, req.get('Cookie'));
          res.setHeader("content-type", 'application/pdf');
          pdfStream.pipe(res);
        } else {
          res.send(html);
        }
      } catch (err) {
        res.status(err.code || 500).send(err.message || 'Internal server error');
      }
    }
    /* jshint ignore:end */
    
    /**
     * Renders 2d query as comments report
     * 
     * @param {Object} req http request
     * @param {Object} res http response
     */
    /* jshint ignore:start */
    async getPrintQueryReportsComments2d(req, res) {
      const queryId = req.query.id;
      const format = req.query.format;
      
      try {
        const query = await this.models.findQuery(queryId);
        const comments = await this.dataExport.exportQueryCommentData(query);
        const segmentedComments = [{
          title: '- / -',
          comments: [],
          commentCount: 0,
          childCommentCount: 0
        }, {
          title: '+ / -',
          comments: [],
          commentCount: 0,
          childCommentCount: 0
        }, {
          title: '- / +',
          comments: [],
          commentCount: 0,
          childCommentCount: 0
        }, {
          title: '+ / +',
          comments: [],
          commentCount: 0,
          childCommentCount: 0
        }];
        
        const cx = 7 / 2;
        const cy = 7 / 2;
      
        comments.forEach((comment) => {
          const x = comment.x;
          const y = comment.y;
          const xSide = x > cx ? 1 : 0;
          const ySide = y > cy ? 1 : 0;
          const segmentComments = segmentedComments[xSide + (ySide * 2)];
          segmentComments.comments.push(comment);        
          segmentComments.commentCount++;
          segmentComments.childCommentCount += comment.childComments.length;
        });
  
        const renderOptions = Object.assign({
          query: query,
          segmentedComments: segmentedComments
        }, req.liveDelphi);
        
        const compiledPug = pug.compileFile(`${__dirname}/../../views/reports/comments2d.pug`);
        const html = compiledPug(renderOptions);

        if (format === 'PDF') {
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const pdfStream = await this.pdf.renderPdf(html, baseUrl, req.get('Cookie'), {
            "header": {
              "height": "0.5in"
            },
            "footer": {
              "height": "0.5in"
            }
          });
          
          res.setHeader("content-type", 'application/pdf');
          pdfStream.pipe(res);
        } else {
          res.send(html);
        }
      } catch (err) {
        res.status(err.code || 500).send(err.message || 'Internal server error');
      }
    }
    /* jshint ignore:end */
    
    /**
     * Renders 2d query as scatter chart
     * 
     * @param {Object} req http request
     * @param {Object} res http response
     */
    /* jshint ignore:start */
    async getRenderQueryChartsScatter2d(req, res) {
      const queryId = req.query.id;
      const size = req.query.size || 600;
      
      try {
        const buffer = await this.charts.renderQuery2dScatterChartPng(queryId, size);
        res.setHeader("content-type", 'image/png');
        buffer.stream.pipe(res);
      } catch (err) {
        res.status(err.code || 500).send(err.message || 'Internal server error');
      }
    }
    /* jshint ignore:end */
    
    register(app, accessControl) {
      this.accessControl = accessControl;
      // Navigation
     
      app.get("/", accessControl.requireLoggedIn(), this.getIndex.bind(this));
      app.get("/login", accessControl.requireLoggedIn(), this.getLogin.bind(this)); 
    
      app.post('/joinQuery/:queryId', this.postJoinQuery.bind(this));
    
      // Live query
    
      app.get("/queries", accessControl.requireLoggedIn(), this.getQueries.bind(this));
      app.get("/queries/live", accessControl.requireLoggedIn(), this.getLiveQuery.bind(this));
      app.get("/queries/live-comments", accessControl.requireLoggedIn(), this.getQueryLiveComments.bind(this));
      
      // Query playback
      
      app.get("/queries/playback", accessControl.requireLoggedIn(), this.getQueryPlayback.bind(this));
      app.get("/queries/comment-playback", accessControl.requireLoggedIn(), this.getQueryCommentPlayback.bind(this));
      
      // Query management

      app.get("/manage/queries", accessControl.requireLoggedIn(), this.getManageQueries.bind(this));
      app.get("/manage/queries/create", accessControl.requireLoggedIn(), this.getCreateQuery.bind(this));
      app.post("/manage/queries/create", accessControl.requireLoggedIn(), this.postCreateQuery.bind(this));
      app.get("/manage/queries/edit", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.getEditQuery.bind(this));
      app.put("/manage/queries/edit", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'body', name: 'id'}}), this.putEditQuery.bind(this));
      app.delete("/manage/queries/delete", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.deleteQuery.bind(this));
      app.delete("/manage/queries/deleteData", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.deleteQueryData.bind(this));
      
      
      app.get("/manage/queries/edit", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.getEditQuery.bind(this));
      
      app.get("/manage/queries/export-query-answers", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.getExportQueryAnswers.bind(this));
      app.get("/manage/queries/export-query-comments", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.getExportQueryComments.bind(this));
      
      // Query folder management
      
      app.get("/manage/queryfolders", accessControl.requireLoggedIn(), this.getManageQueryFolders.bind(this));
      app.post("/manage/queryfolders", accessControl.requireLoggedIn(), this.postCreateQueryFolder.bind(this));

      app.get("/manage/queries/reports/scatter2d", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.getPrintQueryReportsScatter2d.bind(this));
      app.get("/manage/queries/reports/comments2d", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.getPrintQueryReportsComments2d.bind(this));
      app.get("/manage/queries/charts/scatter2d", accessControl.protectResourceMiddleware({type: 'query', scopes: [], id: { from: 'query', name: 'id'}}), this.getRenderQueryChartsScatter2d.bind(this));
      
      // Others
      
      app.post('/join', this.join.bind(this));
      app.get('/keycloak.json', this.getKeycloakJson.bind(this));
    }
    
    handleError(req, res, err) {
      console.error(err);
      res.status(500).send(err);
    }
    
    getAllowedResourceIdsWIthType(entitlements, type) {
      const result = [];
      const permissions = entitlements.permissions;
      permissions.forEach((permission) => {
      const resourceParts = permission.resource.split(':');
      if (resourceParts[0] === type) {
        result.push(resourceParts[1]);
      }
      });

      return result;
    }
    
    getLoggedUserId(req) {
      return this.accessControl.getLoggedUserId(req);
    }
    
  };

  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const models = imports['live-delphi-models'];
    const dataExport = imports['live-delphi-data-export'];
    const resourceManagement = imports['live-delphi-resource-management'];
    const charts = imports['live-delphi-charts'];
    const analysis = imports['live-delphi-analysis'];
    const pdf = imports['live-delphi-pdf'];
    const routes = new Routes(logger, models, dataExport, resourceManagement, charts, analysis, pdf);

    register(null, {
      'live-delphi-routes': routes
    });
  };

})();
