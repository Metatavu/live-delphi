/*jshint esversion: 6 */
/* global moment */

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
      
      $('#progressBar').mouseup($.proxy(this._onProgressBarMouseUp, this));
      $('#progressBar').mousedown($.proxy(this._onProgressBarMouseDown, this));
      $('#progressBar').mousemove($.proxy(this._onProgressMouseMove, this));
    },
    
    _getCurrentQueryId: function () {
      return parseInt($('#chart').attr('data-query-id'));
    },
    
    _startPlaying: function() {
      this.playing = true;
      $('.play-button').hide();
      $('.pause-button').show();
      
      if (this.currentTime >= this.last) {
        this.currentTime = this.first;
        this.element.liveDelphiChart('reset');
      }
      
      this._play();
    },
    
    _pausePlaying: function () {
      this.playing = false;
      $('.play-button').show();
      $('.pause-button').hide();
    },
    
    _play: function () {
      setTimeout(() => {
        if (this.playing) {
          this._loadNextSecond(this.currentTime);
          this.currentTime += 1000;

          this.currentWatchDuration = (((this.currentTime - this.first) / (this.last - this.first)) * 100);

          $('#progressBar').attr('value', this.currentWatchDuration);
          this._updateTime();

          if (this.currentWatchDuration >= 100) {
            this._pausePlaying();
          } else {
            this._play();
          }
        }
      }, 1000);
    },
    
    _loadNextSecond: function (currentTime) {
      this.element.liveDelphiClient('sendMessage', {
        'type': 'list-latest-answers',
        'data': {
          'queryId': this._getCurrentQueryId(),
          'before': currentTime,
          'after': currentTime + 1000,
          'resultMode': 'batch'
        }
      });
    },
    
    _seekTo: function (time) {
      this.currentTime = time;
      this.element.liveDelphiChart('reset');
      this.element.liveDelphiClient('sendMessage', {
        'type': 'list-latest-answers',
        'data': {
          'queryId': this._getCurrentQueryId(),
          'before': time,
          'resultMode': 'batch'
        }
      });
    },
    
    _updateTime: function () {
      $('.current-time').text(this._formatTime(this.currentTime));
      $('.end-time').text(this._formatTime(this.last));
    },
    
    _prepareQuery: function () {      
      this.element.liveDelphiClient('sendMessage', {
        'type': 'find-query-duration',
        'data': {
          'queryId': $('#chart').attr('data-query-id')
        }
      });
    },
    
    _formatTime: function (ms) {
      return moment(new Date(ms)).format('l LTS');
    },
    
    _onProgressBarMouseUp: function (e) {
      e.preventDefault();
      
      this.clicking = false;
      
      if (this.playAfterSliderMove) {
        this.playing = true;
        this._startPlaying();
      }
      
      const element = $('#progressBar');
      const valueClicked = e.offsetX * parseInt($('#progressBar').attr('max')) / element.outerWidth();
      $('#progressBar').attr('value', valueClicked);
      
      this.currentTime = this.first + ((valueClicked / 100) * (this.last - this.first));
      this._seekTo(this.currentTime);
    },
    
    _onAnswersFound(event, data) {
      const queryId = data.queryId;
      if (this._getCurrentQueryId() === queryId) {
        const answers = data.answers;
        answers.forEach((answer) => {
          this.element.liveDelphiChart('userData', answer.userHash, {
            x: answer.x,
            y: answer.y
          });
        });
      }
    },
    
    _onConnect: function (event, data) {
      this.element.liveDelphiChart();      
      this._prepareQuery();
    },
    
    _onProgressBarMouseDown: function () {
      e.preventDefault();
      
      if (this.playing) {
        this.playing = false;
        this.playAfterSliderMove = true;
      } else {
        this.playAfterSliderMove = false;
      }
      
      this.clicking = true;
    },
    
    _onProgressMouseMove: function (e) {
      e.preventDefault();
      
      if (this.clicking) {
        const element = $('#progressBar');
        const valueClicked = e.offsetX * parseInt($('#progressBar').attr('max')) / element.outerWidth();
        $('#progressBar').attr('value', valueClicked);

        this.currentTime = this.first + ((valueClicked / 100) * (this.last - this.first));
        this._seekTo(this.currentTime);
      }
    },
    
    _onPlayButtonClicked: function () {
      this._startPlaying();
    },
    
    _onPauseButtonClicked: function () {
      this._pausePlaying();
    },
    
    _onDurationFound: function (event, data) {
      this.first = data.first;
      this.last = data.last;
      this.currentTime = data.first;
      
      this._updateTime();
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
    $("#chart").queryPlayback();
  });
  
})();
