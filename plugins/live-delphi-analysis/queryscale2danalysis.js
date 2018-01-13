/* jshint esversion: 6 */
(() => {
  'use strict';

  /**
   * Class representing scale 2d query analysis
   */
  class QueryScale2dAnalysis {
  
    /**
     * Constructor
     * 
     * @param {Number} answerCount answer counts
     * @param {Number[]} answerGroupCounts answer counts by groups
     */
    constructor (answerCount, answerGroupCounts) {
     this.answerCount = answerCount;
     this.answerGroupCounts = answerGroupCounts;
    }
    
    /**
     * Returns answer count
     * 
     * @return {Number} answer count
     */
    getAnswerCount() {
      return this.answerCount;
    }
    
    /**
     * Returns answer counts by groups
     * 
     * @return {Number[]} answerGroupCounts answer counts by groups
     */
    getAnswerGroupCounts() {
      return this.answerGroupCounts;
    }

  }
  
  module.exports = QueryScale2dAnalysis;
  
})();