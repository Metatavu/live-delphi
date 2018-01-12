/* jshint esversion: 6 */
/* global __dirname, Promise */
(() => {
  'use strict';
  
  const ChartjsNode = require('chartjs-node');
  
  /**
   * Chart drawing functionalities for Live delphi
   */
  class Charts {
    
    /**
     * Constructor
     * 
     * @param {Object} logger logger
     * @param {Object} models models
     * @param {Object} dataExport dataExport
     */
    constructor (logger, models, dataExport) {
      this.logger = logger;
      this.models = models;
      this.dataExport = dataExport;
    }
    
    /**
     * Converts value from range to new range
     * 
     * @param {Number} value value
     * @param {Number} fromLow from low
     * @param {Number} fromHigh from high
     * @param {Number} toLow to low
     * @param {Number} toHigh to high
     * @return new value
     */
    convertToRange(value, fromLow, fromHigh, toLow, toHigh) {
      const fromLength = fromHigh - fromLow;
      const toRange = toHigh - toLow;
      const newValue = toRange / (fromLength / value);
      
      if (newValue < toLow) {
        return toLow;
      } else if (newValue > toHigh) {
        return toHigh;
      }
      
      return newValue;
    }
    
    /**
     * Returns point color within 2d scale matrix
     * 
     * @param {String} colorX color of x axis 
     * @param {String} colorY color of y axis
     * @param {Number} x value x
     * @param {Number} y value y
     * @param {Number} maxX max x
     * @param {Number} maxY max y
     * @return {String} color
     */
    getColor(colorX, colorY, x, y, maxX, maxY) {
      const cX = colorX || 'RED';
      const cY = colorY || 'BLUE';
      const bColor = 100;
      const xColor = Math.floor(this.convertToRange(x, 0, maxX, 0, 255));
      const yColor = Math.floor(this.convertToRange(y, 0, maxY, 0, 255));
      const r = cX === 'RED' ? xColor : cY === 'RED' ? yColor : bColor;
      const g = cX === 'GREEN' ? xColor : cY === 'GREEN' ? yColor : bColor;
      const b = cX === 'BLUE' ? xColor : cY === 'BLUE' ? yColor : bColor;
      
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    /* jshint ignore:start */
    async renderQuery2dScatterChartPng(queryId, size) {
      const ticks = ["---", "--", "-", "-/+", "+","++", "+++"];

      const query = await this.models.findQuery(queryId);
      const queryDatas = await this.dataExport.exportQueryLatestAnswerDataAsQueryData(query);

      const datasets = queryDatas.getEntries().map((entry) => {
        const x = entry.getX();
        const y = entry.getY();

        return {
          data: [{x: x, y: y}],
          pointBackgroundColor: this.getColor(query.colorx, query.colory, x, y, ticks.length, ticks.length)
        };
      });

      const chartJsOptions = {
        type: 'line',
        data: {
          datasets: datasets
        },
        options: {
          tooltips: {
            enabled: false
          },
          legend: {
            display: false
          },
          scales: {
            xAxes: [{
              gridLines: {
                lineWidth: [1, 1, 1, 2, 1, 1],
                color: [
                  'rgba(0, 0, 0, 0.1)',
                  'rgba(0, 0, 0, 0.1)',
                  'rgba(0, 0, 0, 0.1)',
                  'rgba(0, 0, 0, 0.3)',
                  'rgba(0, 0, 0, 0.1)',
                  'rgba(0, 0, 0, 0.1)'
                ]
              },
              type: 'linear',
              position: 'bottom',
              ticks: {
                min: 0,
                max: 6,
                stepSize: 1,
                callback: (value, index, values) => {
                  return ticks[value];
                }
              }
            }],
            yAxes: [{
              gridLines: {
                lineWidth: [1, 1, 1, 2, 1, 1],
                color: [
                  'rgba(0, 0, 0, 0.1)',
                  'rgba(0, 0, 0, 0.1)',
                  'rgba(0, 0, 0, 0.1)',
                  'rgba(0, 0, 0, 0.3)',
                  'rgba(0, 0, 0, 0.1)',
                  'rgba(0, 0, 0, 0.1)'
                ]
              },
              type: 'linear',
              ticks: {
                mirror: true,
                labelOffset: -100,
                min: 0,
                max: 6,
                stepSize: 1,
                callback: (value, index, values) => {
                  return ticks[value];
                }
              }
            }]
          }
        }
      };

      const chartNode = new ChartjsNode(size, size);
      await chartNode.drawChart(chartJsOptions);
      return chartNode.getImageStream('image/png');
    }
    /* jshint ignore:end */
    
  } 
  
  module.exports = (options, imports, register) => {
    const logger = imports['logger'];
    const dataExport = imports['live-delphi-data-export'];
    const models = imports['live-delphi-models'];
    const charts = new Charts(logger, models, dataExport);
    
    register(null, {
      'live-delphi-charts': charts
    });
  };
  
})();