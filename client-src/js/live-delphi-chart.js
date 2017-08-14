/* jshint esversion: 6 */
/* global window, document, WebSocket, MozWebSocket, $, _, bootbox*/
(function() {
  'use strict';
  
  $.widget("custom.liveDelphiChart", {
    
    options: {
      ticks: ["---", "--", "-", "-/+", "+","++", "+++"],
      maintainAspectRatio: true,
      responsive: true,
      maxX: 6,
      maxY: 6,
      pendingTime: 1000,
      tooltipActive: false,
      fadeUpdateInterval: 200
    },
    
    _create : function() {
      this.reset();
      setInterval(() => { this._updateFade() }, this.options.fadeUpdateInterval);
    },
    
    reset: function () {
      this._userHashes = [];
      this._series = [];
      this.redraw();
    },
    
    userData: function (userHash, data) {
      var index = this._userHashes.indexOf(userHash);
      if (index !== -1) {
        var lastUpdated = new Date().getTime();
        this._series[index].data[0] = data;
        this._series[index].pointBackgroundColor = this.getColor(data, lastUpdated);
        this._series[index].lastUpdated = lastUpdated;
      } else {
        this._userHashes.push(userHash);
        this._series.push(this._getDataSet(data));
      }
      
      this.update();
    },
    
    redraw: function () {
      this._initializeChart();
      this.update();
    },
    
    update: function  () {
      this._scatterChart.update();
    },
    
    getColor: function (value, updated) {
      var red = Math.floor(this._convertToRange(value.x, 0, this.options.maxX, 0, 255));
      var blue = Math.floor(this._convertToRange(value.y, 0, this.options.maxY, 0, 255));
      var age = new Date().getTime() - updated;
      var opacity = this._convertToRange(age, 0, this.options.pendingTime, 0, 1);
      return "rgba(" + [red, 50, blue, opacity].join(',') + ")";
    },
    
    _initializeChart: function () {
      if (this._scatterChart) {
        try {
          this._scatterChart.destroy();
        } catch (e) {
          console.log(`Error while destroying chart ${e}`);
        }
      }
      
      this._scatterChart = new Chart(this.element, {
        type: 'line',
        data: {
          datasets: this._getSeries()
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
                callback: function(value, index, values) {
                  return this.options.ticks[value];
                }.bind(this)
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
                callback: function(value, index, values) {
                  return this.options.ticks[value];
                }.bind(this)
              }
            }]
          }
        }
      });
    },
    
    _updateFade: function () {
       this._series.forEach($.proxy(function(dataset) {
         dataset.pointBackgroundColor = this.getColor(dataset.data[0], dataset.lastUpdated);
       }, this));
       
       this.update();
    },
    
    _convertToRange: function(value, fromLow, fromHigh, toLow, toHigh) {
      var fromLength = fromHigh - fromLow;
      var toRange = toHigh - toLow;
      var newValue = toRange / (fromLength / value);
      if (newValue < toLow) {
        return toLow;
      } else if (newValue > toHigh) {
        return toHigh;
      } else {
        return newValue;
      }
    },
    
    _getDataSet: function (data) { 
      var lastUpdated = new Date().getTime();
      return {showLine: false, data: [ data ], pointBackgroundColor : this.getColor(data, lastUpdated), pointRadius: 5, lastUpdated: lastUpdated};
    },
    
    _getSeries: function() {
      return this._series;
    }
    
  });
  
}).call(this);