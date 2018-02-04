/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const pdf = require('html-pdf');
  
  /**
   * PDF rendering functionalities for Live delphi
   */
  class Pdf {
    
    /**
     * Constructor
     * 
     * @param {Object} logger logger
     */
    constructor (logger) {
      this.logger = logger;
    }
    
    /**
     * Renders PDF from HTML
     * 
     * @param {String} html html string
     * @param {String} baseUrl base url
     * @param {String} cookie header (optiona)
     * @param {Object} extraOptions extra options for pdf renderer
     * @return {Promise} promise of pdf stream
     */
    renderPdf(html, baseUrl, cookieHeader, extraOptions) {
      return new Promise((resolve, reject) => {
        const options = Object.assign({
          "base": baseUrl
        }, extraOptions || {});
        
        if (cookieHeader) {
          options.httpHeaders = {
            "Cookie": cookieHeader
          };
        }
        
        pdf.create(html, options).toStream((err, stream) => {
          if (err) {
            reject(err);
          } else {
            resolve(stream);
          }
        });
      });
    }
  } 
  
  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const pdf = new Pdf(logger);
    
    register(null, {
      'live-delphi-pdf': pdf
    });
  };
  
})();