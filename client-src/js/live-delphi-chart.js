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
      this._userHashes = [];
      this._series = [];
      this.currentX  = 0;
      this.currentY = 0;
      
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
              type: 'linear',
              position: 'bottom',
              ticks: {
                min: 0,
                max: 6,
                stepSize: 1,
                callback: (value, index, values) => {
                  return this.options.ticks[value];
                }
              }
            }],
            yAxes: [{
              type: 'linear',
              ticks: {
                mirror: true,
                labelOffset: -100,
                min: 0,
                max: 6,
                stepSize: 1,
                callback: (value, index, values) => {
                  return this.options.ticks[value];
                }
              }
            }]
          }
        }
      });
      
      setInterval(() => { this._updateFade() }, this.options.fadeUpdateInterval);
    },
    
    _updateFade: function () {
       this._series.forEach($.proxy(function(dataset) {
         dataset.pointBackgroundColor = this.getColor(dataset.data[0], dataset.lastUpdated);
       }, this));
       
       this._updateChart();
    },
    
    userData: function (userHash, data) {
      this.currentX = data.x;
      this.currentY = data.y;
      
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
      
      this._updateChart();
    },
    
    _updateChart: function  () {
      this._scatterChart.update();
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
    
    getColor: function (value, updated) {
      var red = Math.floor(this._convertToRange(value.x, 0, this.options.maxX, 0, 255));
      var blue = Math.floor(this._convertToRange(value.y, 0, this.options.maxY, 0, 255));
      var age = new Date().getTime() - updated;
      var opacity = this._convertToRange(age, 0, this.options.pendingTime, 0, 1);
      return "rgba(" + [red, 50, blue, opacity].join(',') + ")";
    },
    
    _getDataSet: function (data) { 
      var lastUpdated = new Date().getTime();
      return {showLine: false, data: [ data ], pointBackgroundColor : this.getColor(data, lastUpdated), pointRadius: 5, lastUpdated: lastUpdated};
    },
    
    _getSeries: function() {
      return this._series;
    }
    
  });
  
  $('#fullScreen').click(function() {
    var elem = $('.chart-container')[0];

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
  });
  
}).call(this);