/* jshint esversion: 6 */
/* global window, document, WebSocket, MozWebSocket, $, _, bootbox, QueryUtils*/
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
        const lastUpdated = new Date().getTime();
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
      const age = new Date().getTime() - updated;
      const alpha = QueryUtils.convertToRange(age, 0, this.options.pendingTime, 0, 1);
      return QueryUtils.getColor(this.options.colorX, this.options.colorY, value.x, value.y, this.options.maxX, this.options.maxY, alpha);
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
    
    _getDataSet: function (data) { 
      var lastUpdated = new Date().getTime();
      return {showLine: false, data: [ data ], pointBackgroundColor : this.getColor(data, lastUpdated), pointRadius: 5, lastUpdated: lastUpdated};
    },
    
    _getSeries: function() {
      return this._series;
    }
    
  });
  
}).call(this);