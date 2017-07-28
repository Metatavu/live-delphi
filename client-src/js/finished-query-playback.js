/*jshint esversion: 6 */
(function(){
  'use strict';
  
  $.widget("custom.queryPlayback", { 
    _create : function() {
      const port = window.location.port;
      const host = window.location.hostname;
      const secure = window.location.protocol === 'https:';
      const wsSession = this.element.attr('data-ws-session');
      const wsProtocol = secure ? 'wss' : 'ws';
      const wsUrl = wsProtocol + '://' + host + ':' + port;
      
      this.clicking = false;
      this.playing = false;
      this.currentWatchDuration = 0;
      this.currentTime = 0;
      
      this.element.liveDelphiClient({
        wsUrl: wsUrl
      });
      
      this.element.on('connect', $.proxy(this._onConnect, this));
      this.element.on('message:query-duration', $.proxy(this._onDurationFound, this));
      this.element.on('message:answers-found', $.proxy(this._onAnswersFound, this));
      
      this.element.liveDelphiClient('connect', wsSession);
      
      $('.play-button').on('click', $.proxy(this._onPlayButtonClicked, this));
      $('.pause-button').on('click', $.proxy(this._onPauseButtonClicked, this));
      
      $('#progressBar').mouseup((e) => { this._onMouseUp(e); });
      $('#progressBar').mousedown((e) => { this._onMouseDown(e); });
      $('#progressBar').mousemove((e) => { this._onMouseMove(e); });

    },
    
    _onMouseUp: function (e) {
      this.clicking = false;
      
      if (this.playAfterSliderMove) {
        this.playing = true;
        this._startPlaying();
      }
      
      const element = $('#progressBar');
      const valueClicked = e.offsetX * parseInt($('#progressBar').attr('max')) / element.outerWidth();
      $('#progressBar').attr('value', valueClicked);
      
      this.currentTime = this.first + ((valueClicked / 100) * (this.last - this.first));
      this._findAnswersByTimeMessage(this.currentTime);
    },
    
    _onMouseDown: function () {
      if (this.playing) {
        this.playing = false;
        this.playAfterSliderMove = true;
      } else {
        this.playAfterSliderMove = false;
      }
      this.clicking = true;
      
    },
    
    _onMouseMove: function (e) {
      if (this.clicking) {
        const element = $('#progressBar');
        const valueClicked = e.offsetX * parseInt($('#progressBar').attr('max')) / element.outerWidth();
        $('#progressBar').attr('value', valueClicked);

        this.currentTime = this.first + ((valueClicked / 100) * (this.last - this.first));
        this._findAnswersByTimeMessage(this.currentTime);
      }
    },
    
    _startPlaying: function() {
      setTimeout(() => {
        if (this.playing) {
          this.currentTime += 1000;
          this._findAnswersByTimeMessage(this.currentTime);
          
          this.currentWatchDuration = (((this.currentTime - this.first) / (this.last - this.first)) * 100);
          $('#progressBar').attr('value', this.currentWatchDuration);
          
          this._startPlaying();
        }
      }, 1000);
    },
    
    _findAnswersByTimeMessage: function (currentTime) {
      this.element.liveDelphiClient('sendMessage', {
        'type': 'find-answers-by-time',
        'data': {
          'queryId': $('#chart').attr('data-query-id'),
          'currentTime': currentTime
        }
      });
    },
    
    _onAnswersFound(event, data) {
      this.currentTime = new Date(data.createdAt).getTime();
      this.element.liveDelphiChart('userData', data.userHash, {
        x: data.x,
        y: data.y
      });
    },
    
    _onConnect: function (event, data) {
      this.element.liveDelphiChart();      
      this._prepareQuery();
    },
    
    _prepareQuery: function () {      
      this.element.liveDelphiClient('sendMessage', {
        'type': 'find-query-duration',
        'data': {
          'queryId': $('#chart').attr('data-query-id')
        }
      });
    },
    
    _onPlayButtonClicked: function () {
      this.playing = true;
      this._startPlaying();
    },
    
    _onPauseButtonClicked: function () {
      this.playing = false;
    },
    
    _onDurationFound: function (event, data) {
      this.first = data.first;
      this.last = data.last;
      this.currentTime = data.first;
    }
    
  });
  
  $('#fullScreen').click(() => {
    const element = $('.chart-container')[0];

    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    }
  });
  
  $(document).ready(() => {
    $("#chart").queryPlayback();
  });
  
})();
