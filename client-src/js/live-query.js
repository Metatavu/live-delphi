/*jshint esversion: 6 */
(function(){
  'use strict';
  
  $.widget("custom.queryLiveChart", { 
    _create : function() {
      const wsSession = this.element.attr('data-ws-session');
      this.element.liveDelphiClient({
        wsUrl: this._getWebsocketUrl()
      });
      
      this.element.on('connect', $.proxy(this._onConnect, this));
      this.element.on('message:answer-changed', $.proxy(this._onMessageAnswerChanged, this));
      this.element.on('message:answer-found', $.proxy(this._onMessageAnswerFound, this));
      
      this.element.liveDelphiClient('connect', wsSession);
    },
    
    _getWebsocketUrl: function () {
      const secure = window.location.protocol === 'https:';
      const port = window.location.port || (secure ? 443 : 80);
      const host = window.location.hostname;
      const wsProtocol = secure ? 'wss' : 'ws';      
      return `${wsProtocol}://${host}:${port}`;
    },
    
    _getQueryId: function () {
      return parseInt(this.element.attr('data-query-id'));
    },
    
    _onConnect: function (event, data) {
      this.element.liveDelphiChart({
        colorX: this.element.attr('data-color-x'),
        colorY: this.element.attr('data-color-y')
      });
      
      this._loadExistingAnswers();
    },
    
    _loadExistingAnswers: function () {
      this.element.liveDelphiClient('sendMessage', {
        'type': 'list-latest-answers',
        'data': {
          'queryId': this._getQueryId(),
          'before': new Date().getTime()
        }
      });
    },
    
    _onMessageAnswerFound: function (event, data) {
      if (data.queryId === this._getQueryId()) {      
        this.element.liveDelphiChart('userData', data.userHash, {
          x: data.x,
          y: data.y
        });
      } 
    },
    
    _onMessageAnswerChanged: function (event, data) {
      if (data.queryId === this._getQueryId()) {
        this.element.liveDelphiChart('userData', data.userHash, {
          x: data.x,
          y: data.y
        });
      }
    }
    
  });
  
  $('#fullScreen').click((e) => {
    const target = $(e.target);
    $('.chart-outer-container')[0].requestFullscreen();
  });
  
  $(document).on("fullscreenchange", () => {
    if (document.fullscreenElement) {
      const labelHeight = 34;
      const height = $(window).height();
      const width = $(window).width();
      const size = Math.min(height, width) - (labelHeight * 2);

      $('.chart-container').css({
        'width': size + 'px',
        'height': size + 'px'
      });
    } else {
      $('.chart-container').css({
        'width': 'auto',
        'height': 'auto'
      });
    }

    $("#chart").liveDelphiChart('redraw');
  });
  
  $(document).ready(() => {
    $("#chart").queryLiveChart();
  });
  
})();
