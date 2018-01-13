/* jshint esversion: 6 */
(() => {
  'use strict';

  /**
   * Class representing scale 2d query data
   */
  class QueryScale2dData {
  
    /**
     * Constructor
     * 
     * @param {QueryEntry2d[]} entries
     */
    constructor (entries) {
     this.entries = entries;
    }

    /**
     * Returns array of entries
     * 
     * @return {QueryEntryScale2d[]} array of entries
     */
    getEntries() {
      return this.entries;
    }
    
    /**
     * Returns data as array of userHash, x, y -arrays
     * 
     * @return {Array} data as array of userHash, x, y -arrays
     */
    getRows() {
      return this.getEntries().map((entry) => entry.getRow());  
    }

  }
  
  module.exports = QueryScale2dData;
  
})();