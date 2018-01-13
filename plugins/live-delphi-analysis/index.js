/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const QueryScale2dAnalysis = require(`${__dirname}/queryscale2danalysis`);
  
  /**
   * Data analysis functionalities for Live delphi
   */
  class Analysis {
    
    /**
     * Constructor
     * 
     * @param {Object} logger logger
     */
    constructor (logger) {
      this.logger = logger;
    }
    
    /**
     * Analyze scale 2d data
     * 
     * @param {QueryScale2dData} queryScale2dData query data
     * @return {undefined}
     */
    analyzeScale2d(queryScale2dData) {
      const answerCount = queryScale2dData.getEntries().length;
      const answerGroupCounts = [0, 0, 0, 0];
      const cx = 7 / 2;
      const cy = 7 / 2;
      
      queryScale2dData.getEntries().forEach((entry) => {
        const xSide = entry.getX() > cx ? 1 : 0;
        const ySide = entry.getY() > cy ? 1 : 0;
        answerGroupCounts[xSide + (ySide * 2)] += 1;
      });
      
      return new QueryScale2dAnalysis(answerCount, answerGroupCounts);
    }
    
  } 
  
  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const dataExport = imports['live-delphi-data-export'];
    const analysis = new Analysis(logger);
    
    register(null, {
      'live-delphi-analysis': analysis
    });
  };
  
})();