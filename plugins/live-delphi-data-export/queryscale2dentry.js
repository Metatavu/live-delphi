/* jshint esversion: 6 */
(() => {
  'use strict';

  /**
   * Class representing a single entry in a scale query data
   */
  class QueryScale2dEntry {
  
    /**
     * Constructor
     * 
     * @param {String} userHash hashed user id
     * @param {Number} x answer x
     * @param {Number} y answer y
     */
    constructor (userHash, x, y) {
      this.userHash = userHash;
      this.x = x;
      this.y = y;
    }

    /**
     * Returns hashed user id 
     * 
     * @return {String} user hash
     */
    getUserHash() {
      return this.userHash;
    }

    /**
     * Returns user's answer x
     * 
     * @return {Number} answer x
     */
    getX() {
      return this.x;
    }

    /**
     * Returns user's answer y
     * 
     * @return {Number} answer y
     */
    getY() {
      return this.y;
    }
    
    /**
     * Returns data as a "row" data array
     * 
     * @return {Object[]} data as a "row" data array
     */
    getRow() {
      return [ this.getUserHash(), this.getX(), this.getY() ];
    }

  }
  
  module.exports = QueryScale2dEntry;
  
})();