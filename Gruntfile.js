/*global module:false*/

const fs = require('fs');
const util = require('util');

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt);
  
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
  
  grunt.registerTask('default', [ 'sass:client', 'babel:client' ]);
};