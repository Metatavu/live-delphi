/*global module:false*/

const fs = require('fs');
const util = require('util');

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);
  
  grunt.registerMultiTask('generate-config', 'Generates config.js', function() {
    const config = this.data.options.config;
        
    const values = {
      server: config.server
    };
    
    fs.writeFileSync(this.data.options.output, util.format('function getConfig() { return %s; };', JSON.stringify(values)));
    
    return true;
  });
  
  grunt.initConfig({
    'sass': {
      client: {
        options: {
          style: 'compressed'
        },
        files: [{
          expand: true,
          cwd: 'client-src/scss',
          src: ['*.scss'],
          dest: 'public/css',
          ext: '.min.css'
        }]
      }
    },
    'generate-config': {
      client: {
        'options': {
          'config': require(__dirname + '/config.json').client,
          'output': 'public/js/config.js'
        }
      }
    },
    'babel': {
      options: {
        sourceMap: true,
        minified: true
      },
      client: {
        files: [{
          expand: true,
          cwd: 'client-src/js',
          src: ['*.js'],
          dest: 'public/js',
          ext: '.js'
        }]
      }
    }
  });
  
  grunt.registerTask('default', [ 'sass:client', 'generate-config:client', 'babel:client' ]);
};