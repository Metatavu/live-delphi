/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const _ = require('lodash');
  const async = require('async');
  const util = require('util');
  const Promise = require('bluebird');
  
  class Models {
    
    constructor (logger, shadySequelize) {
      this.logger = logger;
      this.sequelize = shadySequelize.sequelize;
      this.Sequelize = shadySequelize.Sequelize;
      this.defineModels();
    }
    
    async defineModels() {
      const Sequelize = this.Sequelize;
      
      try {
        await this.defineModel('ConnectSession', {
          sid: {
            type: Sequelize.STRING(191),
            primaryKey: true
          },
          userId: Sequelize.STRING(191),
          expires: Sequelize.DATE,
          data: Sequelize.TEXT
        });

        await this.defineModel('QueryFolder', {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
          name: { type: Sequelize.STRING(191), allowNull: false },
          accessCode: { type: Sequelize.STRING(191) }
        });

        await this.defineModel('Query', {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
          folderId: { type: Sequelize.BIGINT, references: { model: this.QueryFolder, key: 'id' } },
          start: { type: Sequelize.DATE },
          end: { type: Sequelize.DATE },
          name: { type: Sequelize.STRING(191) },
          labelx: { type: Sequelize.STRING(191) },
          labely: { type: Sequelize.STRING(191) },
          colorx: { type: Sequelize.STRING(191) },
          colory: { type: Sequelize.STRING(191) },
          segment1Background: { type: Sequelize.STRING(191) },
          segment2Background: { type: Sequelize.STRING(191) },
          segment3Background: { type: Sequelize.STRING(191) },
          segment4Background: { type: Sequelize.STRING(191) },
          thesis: { type: 'LONGTEXT', allowNull: false },
          type: { type: Sequelize.STRING(191), allowNull: false }
        }, {
          paranoid: true
        });

        await this.defineModel('QueryEditor', {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
          queryId: { type: Sequelize.BIGINT, allowNull: false, references: { model: this.Query, key: 'id' } },
          userId: { type: Sequelize.STRING(191), allowNull: false, validate: { isUUID: 4 }  },
          role: { type: Sequelize.STRING(191), allowNull: false }
        }, {
          indexes: [{
            name: 'UN_QUERYEDITOR_QUERYID_USER_ID',
            unique: true,
            fields: ['queryId', 'userId']
          }]
        });

        await this.defineModel('QueryUser', {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
          queryId: { type: Sequelize.BIGINT, allowNull: false, references: { model: this.Query, key: 'id' } },
          userId: { type: Sequelize.STRING(191),  allowNull: false, validate: { isUUID: 4 }  }
        }, {
          indexes: [{
            name: 'UN_QUERYUSER_QUERYID_USER_ID',
            unique: true,
            fields: ['queryId', 'userId']
          }]
        });

        await this.defineModel('Session', {
          id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
          userId: { type: Sequelize.STRING(191),  allowNull: false, validate: { isUUID: 4 } },
          queryUserId: { type: Sequelize.BIGINT, references: { model: this.QueryUser, key: 'id' } }
        });

        await this.defineModel('Answer', {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
          queryUserId: { type: Sequelize.BIGINT, allowNull: false, references: { model: this.QueryUser, key: 'id' } },
          x: { type: Sequelize.DOUBLE },
          y: { type: Sequelize.DOUBLE }
        });

        await this.defineModel('Comment', {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true, allowNull: false },
          isRootComment: { type: Sequelize.BOOLEAN, allowNull: false },
          parentCommentId: { type: Sequelize.BIGINT, references: { model: 'Comments', key: 'id' } },
          queryUserId: { type: Sequelize.BIGINT, allowNull: false, references: { model: this.QueryUser, key: 'id' } },
          queryId: { type: Sequelize.BIGINT, allowNull: false, references: { model: this.Query, key: 'id' } },
          comment: { type: Sequelize.TEXT, allowNull: false },
          x: { type: Sequelize.DOUBLE },
          y: { type: Sequelize.DOUBLE }
        });
      } catch (err) {
        this.logger.error("Error defining models: ");
        this.logger.error(err);
      }
    }
    
    defineModel(name, attributes, options) {
      this[name] = this.sequelize.define(name, attributes, Object.assign(options || {}, {
        charset: 'utf8mb4',
        dialectOptions: {
          collate: 'utf8mb4_unicode_ci'
        }
      }));
      
      return this[name].sync();
    }
    
    // Sessions
    
    createSession(userId) {
      return this.sequelize.sync()
        .then(() => this.Session.create({
          userId: userId
      }));
    }
    
    findSession(id) {
      return this.Session.findOne({ where: { id : id } });
    }
    
    updateSessionQueryUserId(sessionId, queryUserId) {
      return this.Session.update({
        queryUserId: queryUserId
      }, {
        where: {
          id: sessionId
        }
      });
    }
    
    deleteSession(id) {
      return this.Session.destroy({ where: { id : id } });
    }
    
    deleteSessionsByQueryId(queryId, options) {
      const queryUsersSQL = this.sequelize.dialect.QueryGenerator.selectQuery('QueryUsers', {
        attributes: ['id'],
        where: { queryId: queryId }
      })
      .slice(0, -1);
      
      return this.Session.destroy(Object.assign(options || {}, {
        where: { queryUserId: { [this.Sequelize.Op.in]: this.sequelize.literal(`(${queryUsersSQL})`)} }
      }));
    }
    
    // Queries
    
    createQuery(start, end, name, thesis, labelx, labely, colorx, colory, segment1Background, segment2Background, segment3Background, segment4Background, type, folderId) {
      return this.Query.create({
          start: start,
          end: end,
          name: name,
          thesis: thesis,
          labelx: labelx,
          labely: labely,
          colorx: colorx,
          colory: colory,
          type: type,
          segment1Background: segment1Background,
          segment2Background: segment2Background,
          segment3Background: segment3Background,
          segment4Background: segment4Background,
          folderId: folderId
      });
    }
    
    findQuery(id) {
      return this.Query.findOne({ where: { id : id } });
    }
    
    listQueriesCurrentlyInProgress() {
      const now = new Date();
      return this.Query.findAll({ where: { start: { [this.Sequelize.Op.lte]: now }, end: { [this.Sequelize.Op.gte]: now } }, order: [ [ 'start', 'DESC' ] ]});
    }
    
    listUnFolderedQueriesCurrentlyInProgress() {
      const now = new Date();
      return this.Query.findAll({ where: { start: { [this.Sequelize.Op.lte]: now }, end: { [this.Sequelize.Op.gte]: now }, folderId: null }, order: [ [ 'start', 'DESC' ] ]});
    }
    
    listQueriesCurrentlyInProgressByFolderId(folderId) {
      const now = new Date();
      return this.Query.findAll({ where: { start: { [this.Sequelize.Op.lte]: now }, end: { [this.Sequelize.Op.gte]: now }, folderId: folderId  }, order: [ [ 'start', 'DESC' ] ]});
    }

    listEndedQueriesByFolderIds(folderIds) {
      const now = new Date();
      return this.Query.findAll({ where: { start: { [this.Sequelize.Op.lte]: now }, end: { [this.Sequelize.Op.lte]: now }, folderId: { [this.Sequelize.Op.in]: folderIds } }, order: [ [ 'start', 'DESC' ] ]});
    }
    
    listEndedQueries() {
      const now = new Date();
      return this.Query.findAll({ where: { start: { [this.Sequelize.Op.lte]: now }, end: { [this.Sequelize.Op.lte]: now } }, order: [ [ 'start', 'DESC' ] ]});
    }
    
    listQueriesByEditorUserId(userId) {
      const attributes = [ [ this.Sequelize.fn('DISTINCT', this.Sequelize.col('queryId')) ,'queryId'] ];
      return this.QueryEditor.findAll({ attributes: attributes,  where: { userId: userId } })
        .then((result) => {
          const queryIds = _.map(result, 'queryId');
           return this.Query.findAll({ where: { id: { [this.Sequelize.Op.in]: queryIds } } });
        });
    }

    listQueriesByIds(QueryIds) {
      return this.Query.findAll({ where: { id: { [this.Sequelize.Op.in]: QueryIds } }});
    }
    
    listQueriesByFolderIds(folderIds) {
      return this.Query.findAll({ where: { folderId: { [this.Sequelize.Op.in]: folderIds } }});
    }
    
    //listQueries
    
    updateQuery(id, start, end, name, thesis, type, labelx, labely, colorx, colory, segment1Background, segment2Background, segment3Background, segment4Background, folderId) {
      return this.Query.update({
        start: start,
        end: end,
        name: name,
        thesis: thesis,
        type: type,
        labelx: labelx,
        labely: labely,
        colorx: colorx,
        colory: colory,
        segment1Background: segment1Background,
        segment2Background: segment2Background,
        segment3Background: segment3Background,
        segment4Background: segment4Background,
        folderId: folderId
      }, {
        where: {
          id: id
        }
      });
    }
    
    deleteQuery(id) {
      return this.Query.destroy({ where: { id : id } });
    }
    
    deleteQueryData(queryId) {
      return this.sequelize.transaction((transaction) => {
        const queries = [
          this.deleteSessionsByQueryId(queryId, {transaction: transaction}),
          this.deleteAnswersByQueryId(queryId, {transaction: transaction}),
          this.deleteCommentsByQueryId(queryId, {transaction: transaction}),
          this.deleteQueryUsersByQueryId(queryId, {transaction: transaction})
        ];
        
        return Promise.all(queries);
      });
    }  

    // QueryEditors
    
    findQueryEditorByQueryIdUserId(queryId, userId) {
      return this.QueryEditor.findOne({ where: { queryId : queryId, userId: userId } });
    }
    
    setQueryEditorUserMap(queryId, editorUserMap) {
      const createPromises = _.map(editorUserMap, (role, userId) => {
        return this.QueryEditor.create({
          queryId: queryId,
          userId: userId,
          role: role
        });
      });
      
      return this.QueryEditor.destroy({ where: { queryId : queryId } })
        .then(() => {
          return this.sequelize.sync()
            .then(() => {
              return Promise.all(createPromises);          
            });
        });
    }

    // QueryUsers
    
    createQueryUser(queryId, userId) {
      return this.QueryUser.findOrCreate({ where: { queryId: queryId, userId: userId } })
        .then((queryUser) => {
          return queryUser[0];
        });
    }
    
    findQueryUser(queryUserId) {
      return this.QueryUser.findOne({ where: { id: queryUserId } });
    }
    
    findQueryUserByQueryIdAndUserId(queryId, userId) {
      return this.QueryUser.findOne({ where: { queryId: queryId, userId: userId } });
    }
    
    listQueryUsersByQueryId(queryId, userId) {
      return this.QueryUser.findAll({ where: { queryId: queryId } });
    }
    
    listQueryUsersByQueryIdAndUserIdNotNull(queryId) {
      return this.QueryUser.findAll({ where: { queryId: queryId, userId: { [this.Sequelize.Op.ne]: null } } });
    }
    
    findQueryUserBySession(id) {
      return this.Session.findOne({ where: { id : id } })
        .then((session) => {
          if (!session) {
            this.logger.warn("Session not defined");
            return null;
          } if (!session.queryUserId) {
            this.logger.warn("Session queryId not defined");
            return null;
          } else {
            return this.QueryUser.findOne({ where: { id : session.queryUserId } });
          }
        });
    }
    
    listQueryUsersByQueryId(queryId) {
      return this.QueryUser.findAll({ where: { queryId: queryId } });
    }
    
    findQueryUser(id) {
      return this.QueryUser.findOne({ where: { id : id } });
    }
    
    deleteQueryUsersByQueryId(queryId, options) {
      return this.QueryUser.destroy(Object.assign(options || {}, { 
        where: { queryId: queryId }
      }));
    }
    
    // Query folders

    createQueryFolder(name, userId, accessCode) {
      return this.QueryFolder.create({
        name: name,
        accessCode: accessCode || null,
        userId: userId
      });
    }

    listQueryFoldersByAccessCodes(accessCodes) {
      return this.QueryFolder.findAll({ where: { accessCode: { [this.Sequelize.Op.in]: accessCodes } }});
    }

    listQueryFoldersByUserId(userId) {
      return this.QueryFolder.findAll({ where: { userId: userId } });
    }

    listQueryFoldersByIds(folderIds) {
      return this.QueryFolder.findAll({ where: { id: { [this.Sequelize.Op.in]: folderIds } }});
    }
    
    // Answers
    
    createAnswer(queryUserId, x, y) {
      return this.sequelize.sync().then(() => this.Answer.create({
        queryUserId: queryUserId,
        x: x,
        y: y
      }));
    }
    
    findFirstAnswerAndLastCommentByQueryUserId(queryUserId, queryId) {
      return this.findLatestCommentByQueryUserId(queryUserId, queryId)
        .then((latest) => {
          return this.findFirstAnswerByQueryUserId(queryUserId)
            .then((first) => {
              if (first && latest) {
                return {
                  "first": first.dataValues.createdAt,
                  "latest": latest.dataValues.createdAt
                };
              }
            });
        });
    }    
    
    listAnswersByQueryUserId(queryUserId) {
      return this.Answer.findAll({ where: { queryUserId: queryUserId } });
    }

    findCommentsByTimeAndQueryUserId(firstTime, secondTime, queryUserId) {
      return this.Comment.findAll({ where: { queryUserId: queryUserId, createdAt: { [this.Sequelize.Op.between]: [firstTime, secondTime] } }, order: [ [ 'createdAt', 'ASC' ] ]});
    }
    
    findAnswersByTimeAndQueryUserId(firstTime, secondTime, queryUserId) {
      return this.Answer.findAll({ where: { queryUserId: queryUserId, createdAt: { [this.Sequelize.Op.between]: [firstTime, secondTime] } }, order: [ [ 'createdAt', 'ASC' ] ]});
    }
    
    findLatestCommentByQueryUserId(queryUserId, queryId) {
      return this.Comment.findOne({ where: { queryUserId: queryUserId, queryId: queryId }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    findLatestAnswerByQueryUserAndCreatedLte(queryUserId, createdAtLte) {
      return this.Answer.findOne({ where: { queryUserId: queryUserId, createdAt : { [this.Sequelize.Op.lte]: createdAtLte } }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    findLatestAnswerByQueryUserAndCreatedGte(queryUserId, createdAtGte) {
      return this.Answer.findOne({ where: { queryUserId: queryUserId, createdAt : { [this.Sequelize.Op.gte]: createdAtGte } }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    findLatestAnswerByQueryUserAndCreatedBetween(queryUserId, createdAtLow, createdAtHigh) {
      return this.Answer.findOne({ where: { queryUserId: queryUserId, createdAt : { [this.Sequelize.Op.between]: [createdAtLow, createdAtHigh] } }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    findLatestAnswerByQueryUser(queryUserId) {
      return this.Answer.findOne({ where: { queryUserId: queryUserId }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    listLatestAnswersByQueryIdAndCreatedLte(queryId, createdAtLte) {
      return this.listQueryUsersByQueryId(queryId)
        .then((queryUsers) => {
          const answerPromises = _.map(queryUsers, (queryUser) => {
            return this.findLatestAnswerByQueryUserAndCreatedLte(queryUser.id, createdAtLte);
          });
  
          return Promise.all(answerPromises);
        });
    }
    
    listLatestAnswersByQueryIdAndCreatedGte(queryId, createdAtGte) {
      return this.listQueryUsersByQueryId(queryId)
        .then((queryUsers) => {
          const answerPromises = _.map(queryUsers, (queryUser) => {
            return this.findLatestAnswerByQueryUserAndCreatedGte(queryUser.id, createdAtGte);
          });
  
          return Promise.all(answerPromises);
        });
    }
    
    listLatestAnswersByQueryIdAndCreatedBetween(queryId, createdAtLow, createdAtHigh) {
      return this.listQueryUsersByQueryId(queryId)
        .then((queryUsers) => {
          const answerPromises = _.map(queryUsers, (queryUser) => {
            return this.findLatestAnswerByQueryUserAndCreatedBetween(queryUser.id, createdAtLow, createdAtHigh);
          });
          
          return Promise.all(answerPromises);
        });
    }
    
    findAnswerMaxCreatedAtByQueryId(queryId) {
      const queryUsersSQL = this.sequelize.dialect.QueryGenerator.selectQuery('QueryUsers', {
        attributes: ['id'],
        where: { queryId: queryId }
      })
      .slice(0, -1);
      
      return this.Answer.max('createdAt', {
        where: {
          queryUserId: { [this.Sequelize.Op.in]: this.sequelize.literal(`(${queryUsersSQL})`)}
        }
      });
    }
    
    findAnswerMinCreatedAtByQueryId(queryId) {
      const queryUsersSQL = this.sequelize.dialect.QueryGenerator.selectQuery('QueryUsers', {
        attributes: ['id'],
        where: { queryId: queryId }
      })
      .slice(0, -1);
      
      return this.Answer.min('createdAt', {
        where: {
          queryUserId: { [this.Sequelize.Op.in]: this.sequelize.literal(`(${queryUsersSQL})`)}
        }
      });
    }
    
    deleteAnswersByQueryId(queryId, options) {
      const queryUsersSQL = this.sequelize.dialect.QueryGenerator.selectQuery('QueryUsers', {
        attributes: ['id'],
        where: { queryId: queryId }
      })
      .slice(0, -1);
      
      return this.Answer.destroy(Object.assign(options || {}, {
        where: { queryUserId: { [this.Sequelize.Op.in]: this.sequelize.literal(`(${queryUsersSQL})`)} }
      }));
    }
          
    // Comments
    
    createComment(isRootComment, parentCommentId, queryUserId, queryId, comment, x, y) {
      return this.sequelize.sync().then(() => this.Comment.create({
        isRootComment: isRootComment,
        parentCommentId: parentCommentId,
        queryUserId: queryUserId,
        queryId: queryId,
        comment:  comment,
        x: x,
        y: y
      }));
    }
    
    listCommentsNewerThanGivenTimeByQueryId(queryId, time) {
     return this.Comment.findAll({ where: { queryId: queryId, createdAt: { [this.Sequelize.Op.gte]: time } } }); 
    }
    
    findFirstAnswerByQueryUserId(queryUserId) {
      return this.Answer.findOne({ where: { queryUserId: queryUserId }, order: [ [ 'createdAt', 'ASC' ] ]});
    }
    
    findComment(id) {
      return this.Comment.findOne({ where: { id : id } });
    }
    
    listCommentsByParentCommentId(parentCommentId) {
      return this.Comment.findAll({ where: { parentCommentId: parentCommentId }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    listCommentsByQueryId(queryId) {
      return this.Comment.findAll({ where: { queryId: queryId }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    listCommentsByQueryIdAndCreatedBetween(queryId, createdAtLow, createdAtHigh) {
      return this.Comment.findAll({ where: { queryId: queryId, createdAt : { [this.Sequelize.Op.between]: [createdAtLow, createdAtHigh] } }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    listCommentsByQueryIdAndCreatedLte(queryId, createdLte) {
      return this.Comment.findAll({ where: { queryId: queryId, createdAt : { [this.Sequelize.Op.lte] : createdLte } }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    listCommentsByQueryIdAndCreatedGte(queryId, createdGte) {
      return this.Comment.findAll({ where: { queryId: queryId, createdAt : { [this.Sequelize.Op.gte] : createdGte } }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    listRootCommentsByQueryId(queryId) {
      return this.Comment.findAll({ where: { queryId: queryId, isRootComment: true }, order: [ [ 'createdAt', 'DESC' ] ]});
    }
    
    findCommentMaxCreatedAtByQueryId(queryId) {
      const queryUsersSQL = this.sequelize.dialect.QueryGenerator.selectQuery('QueryUsers', {
        attributes: ['id'],
        where: { queryId: queryId }
      })
      .slice(0, -1);
      
      return this.Comment.max('createdAt', {
        where: {
          queryUserId: { [this.Sequelize.Op.in]: this.sequelize.literal(`(${queryUsersSQL})`)}
        }
      });
    }
    
    findCommentMinCreatedAtByQueryId(queryId) {
      const queryUsersSQL = this.sequelize.dialect.QueryGenerator.selectQuery('QueryUsers', {
        attributes: ['id'],
        where: { queryId: queryId }
      })
      .slice(0, -1);
      
      return this.Comment.min('createdAt', {
        where: {
          queryUserId: { [this.Sequelize.Op.in]: this.sequelize.literal(`(${queryUsersSQL})`)}
        }
      });
    }
    
    deleteCommentsByQueryId(queryId, options) {
      const queries = [
        this.Comment.destroy(Object.assign(options || {}, { 
          where: { queryId: queryId, parentCommentId: { [this.Sequelize.Op.ne]: null } }
        })),
        this.Comment.destroy(Object.assign(options || {}, { 
          where: { queryId: queryId }
        }))
      ];
      
      return Promise.all(queries);
    }
  } 
  
  module.exports = (options, imports, register) => {
    const shadySequelize = imports['shady-sequelize'];
    const logger = imports['logger'];
    const models = new Models(logger, shadySequelize);
    
    register(null, {
      'live-delphi-models': models
    });
  };
  
})();