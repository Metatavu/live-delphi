/*jshint esversion: 6 */
/* global QueryUtils, moment, _ */

(function(){
  'use strict';
  
  $.widget("custom.queryCommentPlayback", { 
    
    options: {
      maxX: 6,
      maxY: 6
    },
    
    _create : function() {
      this._childComments = {};
      
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
      this.element.on('message:comments-found', $.proxy(this._onMessageCommentsFound, this));
      this.element.on('click', '.comment-container', $.proxy(this._onCommentContainerClick, this));
      $(window).on("resize", $.proxy(this._onWindowResize, this));
      
      this.element.liveDelphiClient('connect', wsSession);
      
      $('.play-button').on('click', $.proxy(this._onPlayButtonClicked, this));
      $('.pause-button').on('click', $.proxy(this._onPauseButtonClicked, this));
      
      $('#progressBar').mouseup($.proxy(this._onProgressBarMouseUp, this));
      $('#progressBar').mousedown($.proxy(this._onProgressBarMouseDown, this));
      $('#progressBar').mousemove($.proxy(this._onProgressMouseMove, this));
      this._refreshLabels();
    },
    
    _startPlaying: function () {
      this.playing = true;
      $('.play-button').hide();
      $('.pause-button').show();
      
      if (this.currentTime >= this.last) {
        this._reset();
      }
      
      this._play();
    },
    
    _pausePlaying: function () {
      this.playing = false;
      $('.play-button').show();
      $('.pause-button').hide();
    },
    
    _reset: function () {
      this.currentTime = this.first;
      this._childComments = {};
      $('.comment-container').remove();
      $('#progressBar').attr('value', 0);
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
        'type': 'list-comments',
        'data': {
          'queryId': this._getQueryId(),
          'after': currentTime,
          'before': currentTime + 999,
          'resultMode': 'batch'
        }
      });
    },
    
    _seekTo: function (time) {
      this.currentTime = time;
      $('.comment-container').remove();
      this._childComments = {};
      
      this.element.liveDelphiClient('sendMessage', {
        'type': 'list-comments',
        'data': {
          'queryId': this._getQueryId(),
          'before': this.currentTime,
          'resultMode': 'batch'
        }
      });
    },
    
    _updateTime: function () {
      $('.current-time').text(this._formatTime(this.currentTime));
      $('.end-time').text(this._formatTime(this.last));
    },
    
    _formatTime: function (ms) {
      return moment(new Date(ms)).format('l LTS');
    },
    
    _sortCommentContainerElements: function (container) {
      $(container).find('.comment-container').sort((a, b) => {
        const aCreated = moment($(a).attr('data-created-at'));
        const bCreated = moment($(b).attr('data-created-at'));
        return aCreated.diff(bCreated);
      }).appendTo(container);
    },
    
    _sortCommentElements: function (x, y) {
      this._sortCommentContainerElements(this._getCommentClassName(x, y));
    },
    
    _getQueryId: function () {
      return parseInt($('.comments-container').attr('data-query-id'));
    },
    
    _getCommentClassName: function (commentX, commentY) {
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
    
    _addRootComment: function (id, x, y, createdAt, comment) {
      const className = this._getCommentClassName(x, y);
      const color = this._getColor(x, y);
      
      $(className).prepend(pugQueryRootComment({
        comment: {
          id: id,
          comment: QueryUtils.htmlLineBreaks(comment),
          color: color,
          createdAt: createdAt,
          createdAtStr: this._formatTime(createdAt),
          x: x,
          y: y
        }
      }));
    },
    
    _addComment: function (id, parentCommentId, x, y, createdAt, comment) {
      if (parentCommentId) {
        if (!this._childComments[parentCommentId]) {
          this._childComments[parentCommentId] = [];
        }
        
        this._childComments[parentCommentId] = _.filter(this._childComments[parentCommentId], (childComment) => {
          return childComment.id !== id;
        });
        
        this._childComments[parentCommentId].push({
          id: id,
          x: x,
          y: y,
          createdAt: createdAt,
          comment: comment
        });
        
        const childCount = this._childComments[parentCommentId].length;
        
        const commentContainer = $(`.comment-container[data-id="${parentCommentId}"] .comment-child-comments`).show().text(`${childCount} child comment(s)`);
        
        this._updateModalChildComments(parentCommentId);
      } else {
        this._addRootComment(id, x, y, createdAt, comment);
      }
    },
    
    _scrollCommentsToBottom: function (x, y) {
      const className = this._getCommentClassName(x, y);
      $(className).animate({ 
        scrollTop: $(className).prop("scrollHeight")
      }, this.options.scrollSpeed);
    },
    
    _scrollModalToBottom: function (modal) {
      const modalContent = modal.find('.modal-content');
      $(modalContent).animate({ 
        scrollTop: $(modalContent).prop("scrollHeight")
      }, this.options.scrollSpeed);
    },
    
    _getModalChildCommentsData: function (rootCommentId) {
      return _.map(this._childComments[rootCommentId], (childComment, index) =>  {
        return Object.assign(childComment, {
          comment: QueryUtils.htmlLineBreaks(childComment.comment),
          createdAtStr: this._formatTime(childComment.createdAt),
          odd: (index % 2) === 0,
          color: this._getColor(childComment.x, childComment.y)
        });
      });
    },
    
    _renderModalChildComments: function (rootCommentId) {
      return pugQueryRootCommentModalChildComments({
        childComments: this._getModalChildCommentsData(rootCommentId)
      });
    },
    
    _updateModalChildComments: function (rootCommentId) {
      const modal = $(`.modal-comment-dialog[data-id="${rootCommentId}"]`);
      if (modal && modal.length) {
        modal.find('.comment-child-comments').html(this._renderModalChildComments(rootCommentId));
        this._scrollModalToBottom(modal);
      }
    },
    
    _getColorX: function () {
      return $(this.element).attr('data-color-x');
    },
    
    _getColorY: function () {
      return $(this.element).attr('data-color-y');
    },
    
    _getColor: function (x, y) {
      return QueryUtils.getColor(this._getColorX(), this._getColorY(), x, y, this.options.maxX, this.options.maxY);
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
    
    _refreshLabels: function () {
      const gridHeight = $('.comments-grid-container').height();
      $('.comments-label-left').width(gridHeight);
    },
    
    _onConnect: function (event, data) {  
      this._prepareQuery();
    },
    
    _prepareQuery: function () {
      this.element.liveDelphiClient('sendMessage', {
        'type': 'find-query-duration',
        'data': {
          'queryId': this._getQueryId()
        }
      });
    },
    
    _onPlayButtonClicked: function () {
      this._startPlaying();
    },
    
    _onPauseButtonClicked: function () {
      this._pausePlaying();
    },
    
    _onDurationFound: function (event, data) {
      if (data.queryId !== this._getQueryId()) {
        return;
      }
      
      this.first = data.first;
      this.last = data.last;
      this.currentTime = data.first;
      this._updateTime();
    },
    
    _onWindowResize: function () {
      this._refreshLabels();
    },
    
    _onMessageCommentsFound: function (event, data) {
      if (data.queryId !== this._getQueryId()) {
        return;
      }
      
      const comments = data.comments;
      
      comments.sort((a, b) => {
        return moment(a.createdAt).diff(moment(b.createdAt));
      });
      
      comments.forEach((comment) => {
        this._addComment(comment.id, comment.parentCommentId, comment.x, comment.y, comment.createdAt, comment.comment);
        this._sortCommentElements(comment.x, comment.y);
        this._scrollCommentsToBottom(comment.x, comment.y);
      });
    },
    
    _onCommentContainerClick: function (event) {
      event.preventDefault();
      
      const commentContainer = $(event.target).closest('.comment-container');
      
      const id = commentContainer.attr('data-id');
      const comment = commentContainer.attr('data-comment');
      const createdAt = commentContainer.attr('data-created-at');
      const x = parseFloat(commentContainer.attr('data-x'));
      const y = parseFloat(commentContainer.attr('data-y'));
      const color = this._getColor(x, y);
      
      const dialog = bootbox.dialog({
        message: pugQueryRootCommentModal({
          comment: {
            id: id,
            comment: QueryUtils.htmlLineBreaks(comment),
            color: color,
            createdAt: createdAt,
            createdAtStr: this._formatTime(createdAt)
          },
          childComments: this._getModalChildCommentsData(id)
        }),
        size: 'large',
        onEscape: true
      });
      
      dialog.addClass('modal-comment-dialog')
        .attr('data-id', id)
        .init(() => {
          setTimeout(() => {
            this._scrollModalToBottom(dialog);
          }, 300);
        });
    },
    
    _onProgressBarMouseUp: function (event) {
      event.preventDefault();
      
      this.clicking = false;
      
      if (this.playAfterSliderMove) {
        this.playing = true;
        this._startPlaying();
      }
      
      const element = $('#progressBar');
      const valueClicked = event.offsetX * parseInt($('#progressBar').attr('max')) / element.outerWidth();
      
      $('#progressBar').attr('value', valueClicked);
      
      this.currentTime = this.first + ((valueClicked / 100) * (this.last - this.first));
      this._seekTo(this.currentTime);
    },
    
    _onProgressBarMouseDown: function (event) {
      event.preventDefault();
      
      if (this.playing) {
        this.playing = false;
        this.playAfterSliderMove = true;
      } else {
        this.playAfterSliderMove = false;
      }
      
      this.clicking = true;
    },
    
    _onProgressMouseMove: function (event) {
      event.preventDefault();
      
      if (this.clicking) {
        const element = $('#progressBar');
        const valueClicked = event.offsetX * parseInt($('#progressBar').attr('max')) / element.outerWidth();
        $('#progressBar').attr('value', valueClicked);

        this.currentTime = this.first + ((valueClicked / 100) * (this.last - this.first));
        this._seekTo(this.currentTime);
      }
    }
    
  });
  
  $('#fullScreen').click((e) => {
    const target = $(e.target);
    $('.chart-outer-container')[0].requestFullscreen();
  });
  
  $(document).ready(() => {
    $(".comments-container").queryCommentPlayback();
  });
  
})();

