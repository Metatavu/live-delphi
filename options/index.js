/*jshint esversion: 6 */
/* global __dirname */

(function() {
  'use strict';
  
  const util = require('util');
  const commandLineArgs = require('command-line-args');
  const getUsage = require('command-line-usage');
  
  /**
   * Command line options
   */
  class Options {
    
    constructor() {
      this.definitions = [
        { name: 'host', alias: 'h', type: String },
        { name: 'port', alias: 'p', type: Number },
        { name: 'help', alias: '?', type: Boolean }
      ];
      
      try {
        this.options = commandLineArgs(this.definitions);
      } catch (e) {
        this.parseException = e;
      }
    }
    
    getError() {
      if (this.parseException) {
        return this.parseException.message;
      }
      
      if (this.options['help']) {
        return 'help';
      }
      
      const required = ['port', 'host'];  
      
      for (var i = 0; i < required.length; i++) {
        var requiredOption = required[i];
        if (!this.options[requiredOption]) {
          return util.format("Missing required option: %s", requiredOption);
        }
      }
      
      return null;
    }
    
    isOk() {
      return !this.getError();
    }
    
    getOptions() {
      return this.options;
    }
    
    getOption(name, defaultValue) {
      return this.options[name] || defaultValue;
    }
    
    printUsage() {
      const sections = [];
      const error = this.getError();
      
      sections.push({
        header: 'Shady Worker',
        content: 'Shady Worker'
      });

      sections.push({      
        header: 'Options',
        optionList: [{
          name: 'host',
          typeLabel: '[underline]{host}',
          description: util.format('hostname')
        }, {
          name: 'port',
          typeLabel: '[underline]{port}',
          description: util.format('port')
        }]
      });
      
      if (error && error !== 'help') {
        sections.push({
          header: error
        });
      };
      
      console.log(getUsage(sections));
    }
    
  }
  
  module.exports = new Options();
           
}).call(this);