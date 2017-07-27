/*jshint esversion: 6 */
(function(){
  'use strict';
  
  $.widget("custom.queryCommentPlayback", { 
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
      this.element.on('message:comment-found', $.proxy(this._onCommentFound, this));
      this.element.on('message:comment-to-remove-found', $.proxy(this._onCommentToRemoveFound, this));
      
      this.element.liveDelphiClient('connect', wsSession);
      
      $('.play-button').on('click', $.proxy(this._onPlayButtonClicked, this));
      $('.pause-button').on('click', $.proxy(this._onPauseButtonClicked, this));
      
      $('#progressBar').on('mouseup', $.proxy(this._onMouseUp, this));
      $('#progressBar').on('mousedown', $.proxy(this._onMouseDown, this));
      $('#progressBar').on('mousemove', $.proxy(this._onMouseMove, this));
      
      this.element.on('click', '.comment-box' ,$.proxy(this._onCommentOpenClicked, this));

    },
    
    _onMouseUp: function (e) {
      this.clicking = false;
      
      if (this.playAfterSliderMove) {
        this.playing = true;
        this._startPlaying();
      }
      
      const element = $('#progressBar');
      const value_clicked = e.offsetX * parseInt($('#progressBar').attr('max')) / element.offsetWidth;
      $('#progressBar').attr('value', value_clicked);
      
      this.currentTime = this.first + ((value_clicked / 100) * (this.last - this.first));
      this._removeComments(this.currentTime);
      this._findCommentsByTimeMessage(this.currentTime);
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
        const element = document.getElementById('progressBar');
        const valueClicked = e.offsetX * parseInt($('#progressBar').attr('max')) / element.offsetWidth;
        $('#progressBar').attr('value', valueClicked);

        this.currentTime = this.first + ((valueClicked / 100) * (this.last - this.first));
        this._removeComments(this.currentTime);
        this._findCommentsByTimeMessage(this.currentTime);
      }
    },
    
    _startPlaying: function() {
      setTimeout(() => {
        if (this.playing) {
          this.currentTime += 1000;
          this._findCommentsByTimeMessage(this.currentTime);
          
          this.currentWatchDuration = (((this.currentTime - this.first) / (this.last - this.first)) * 100);
          $('#progressBar').attr('value', this.currentWatchDuration);
          
          this._startPlaying();
        }
      }, 1000);
    },
    
    _findCommentsByTimeMessage: function (currentTime) {
      this.element.liveDelphiClient('sendMessage', {
        'type': 'find-comments-by-time',
        'data': {
          'queryId': $('.comment-container').attr('data-query-id'),
          'currentTime': currentTime
        }
      });
    },
    
    _removeComments: function (currentTime) {
      this.element.liveDelphiClient('sendMessage', {
        'type': 'find-comments-to-remove-by-time',
        'data': {
          'queryId': $('.comment-container').attr('data-query-id'),
          'currentTime': currentTime
        }
      });
    },
    
    _onCommentToRemoveFound: function (event, data) {
      $(`div[data-comment-id="${data.commentId}"]`).remove();
    },
    
    _onCommentFound(event, data) {
      const commentX = data.x;
      const commentY = data.y;
      const comment = data.comment;
      const commentId = data.commentId;
      const isRootComment = data.isRootComment;
      const parentId = data.parent; 
      const updatedAt = data.updatedAt;
      
      this._prepareComment(commentX, commentY, comment, commentId, isRootComment, parentId, updatedAt);
      this.currentTime = new Date(data.createdAt).getTime();
    },
    
    _prepareComment: function (commentX, commentY, comment, commentId, isRootComment, parentId, updatedAt) {
      const className = this._createClassName(commentX, commentY);
      const color = this._getColor({x: commentX, y: commentY}, updatedAt);
      
      if (isRootComment) {
        if (!$(`div[data-comment-id="${commentId}"]`).length) {
          this._addRootComment(commentId, className, color, comment);
          this._addAnswersAmount(commentId);
        }
      } else {
        if (!$(`p[data-comment-id="${commentId}"]`).length) {
          this._addChildComment(parentId, commentId, comment);
          this._animateNewChildComment(parentId, color);
          this._addAnswersAmount(parentId);
        }
      }
    },
    
    _createClassName: function (commentX, commentY) {
      if (commentX <= 3 && commentY <= 3) {
        return '.comments-3';
      } else if (commentX <= 3 && commentY > 3) {
        return '.comments-1';
      } else if (commentX > 3 && commentY > 3) {
        return '.comments-2';
      } else if (commentX > 3 && commentY <= 3) {
        return '.comments-4';
      }
    },
    
    _addChildComment: function (parentId, commentId, comment) {
      $(`.child-comments-${parentId}`).append(`<p data-comment-id="${commentId}"> ${comment} </p>`);
    },
    
    _addRootComment: function (commentId, className, color, comment) {
      $(className).prepend(`
        <div class="comment-box" data-comment-id="${commentId}">
          <div class="root-comment" style="border-bottom:2px solid ${color}">
            <p class="parent-comment">${comment}</p>
          </div>
          <div class="child-comments-${commentId}"></div>
        </div>`
      );
    },
    
    _animateNewChildComment: function (parentId, color) {
      $(`div[data-comment-id="${parentId}"]`).animate({
        'background-color': color
      }, 100, function() {
        $(`div[data-comment-id="${parentId}"]`).animate({
          'background-color': '#fff'
        }, 100);
      });
    },
    
    _addAnswersAmount: function (parentId) {
      const childCommentsAmount = $(`.child-comments-${parentId} > p`).length;
      $(`.answers-${parentId}`).remove();
      
      $(`div[data-comment-id="${parentId}"] > .root-comment`).append(`
        <a href="#" class="answers-${parentId}">
          Vastauksia ${childCommentsAmount} kpl.
        </a>
      `);
    },
    
    _getColor: function (value, updated) {
      var red = Math.floor(this._convertToRange(value.x, 0, 6, 0, 255));
      var blue = Math.floor(this._convertToRange(value.y, 0, 6, 0, 255));
      return "rgb(" + [red, 50, blue].join(',') + ")";
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
    
    _onCommentOpenClicked: function (event) {
      const element = $(event.target).closest('.comment-box');
      const childId = element.attr('data-comment-id');
      $('.child-comments-'+childId).slideToggle();
    },
    
    _onConnect: function (event, data) {  
      this._prepareQuery();
    },
    
    _prepareQuery: function () {      
      this.element.liveDelphiClient('sendMessage', {
        'type': 'find-query-comments-duration',
        'data': {
          'queryId': $('.comment-container').attr('data-query-id')
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
    const element = $('.comment-container')[0];

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
    $(".comment-container").queryCommentPlayback();
  });
  
})();

