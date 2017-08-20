/*jshint esversion: 6 */
/* global moment, bootbox, _ */

(function(){
  'use strict';
  
  $.widget("custom.queryLiveComments", {
    
    options: {
      scrollSpeed: 400,
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
      
      $('.comments').addClass('loading');
      
      this.element.liveDelphiClient({
        wsUrl: wsUrl
      });
      
      this.element.on('connect', $.proxy(this._onConnect, this));
      this.element.on('message:comments-added', $.proxy(this._onMessageCommentsAdded, this));
      this.element.on('message:comment-added', $.proxy(this._onMessageCommentAdded, this));
      this.element.on('message:comment-found', $.proxy(this._onMessageCommentFound, this));
      $(window).on("resize", $.proxy(this._onWindowResize, this));
      
      this.element.on('click', '.comment-container', $.proxy(this._onCommentContainerClick, this));
      this.element.on('click', '.expand-comments', $.proxy(this._onExpandCommentsClick, this));
      this.element.on('click', '.unexpand-comments', $.proxy(this._onUnexpandCommentsClick, this));
      
      this._refreshLabels();

      this.element.liveDelphiClient('connect', wsSession);
    },
    
    _getQueryId: function () {
      return parseInt(this.element.attr('data-query-id'));
    },
    
    _loadExistingRootComments: function (queryId) {
      this.element.liveDelphiClient('sendMessage', {
        'type': 'list-root-comments-by-query',
        'data': {
          'queryId': this._getQueryId(),
          'resultMode': 'batch'
        }
      });
    },
    
    _loadChildComments: function (parentCommentId) {
      this.element.liveDelphiClient('sendMessage', {
        'type': 'list-child-comments',
        'parentCommentId': parentCommentId
      });
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
          comment: this._htmlLineBreaks(comment),
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
    
    _scrollAllCommentsToBottom: function () {
      $('.comments').each((index, comments) => {
        $(comments).animate({ 
          scrollTop: $(comments).prop("scrollHeight")
        }, this.options.scrollSpeed);
      });
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
      const fromLength = fromHigh - fromLow;
      const toRange = toHigh - toLow;
      const newValue = toRange / (fromLength / value);
      
      if (newValue < toLow) {
        return toLow;
      } else if (newValue > toHigh) {
        return toHigh;
      }
      
      return newValue;
    },
    
    _formatTime: function (time) {
      return moment(new Date(time)).format('l LTS');
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
    
    _sortAllCommentElements: function () {
      $('.comments').each((index, comments) => {
        this._sortCommentContainerElements(comments);
      });
    },
    
    _htmlLineBreaks: function (text) {
      const result = [];
      const paragraphs = (text||'').split('\n');
      
      for (let i = 0; i < paragraphs.length; i++) {
        result.push(`<p>${paragraphs[i]}</p>`);
      }
      
      return result.join('');
    },
    
    _refreshLabels: function () {
      const gridHeight = $('.comments-grid-container').height();
      $('.comments-label-left').width(gridHeight);
    },
    
    _onConnect: function (event, data) {
      this._loadExistingRootComments();
    },    
    
    _onMessageCommentsAdded: function (event, data) {
      const comments = data.comments;
      
      comments.forEach((comment) => {
        if (comment.parentCommentId ===  null) {
          this._loadChildComments(comment.id);
        }
      
        this._addComment(comment.id, comment.parentCommentId, comment.x, comment.y, comment.createdAt, comment.comment);
      });

      this._sortAllCommentElements();
      $('.comments').removeClass('loading');
      this._scrollAllCommentsToBottom();
    },    
    
    _onMessageCommentAdded: function (event, data) {
      const comment = data;
      this._addComment(comment.id, comment.parentCommentId, comment.x, comment.y, comment.createdAt, comment.comment);
      this._sortCommentElements(comment.x, comment.y);
      this._scrollCommentsToBottom(comment.x, comment.y);
    },
    
    _onMessageCommentFound: function (event, data) {
      const comment = data;
      this._addComment(comment.id, comment.parentCommentId, comment.x, comment.y, comment.createdAt, comment.comment);
      this._sortCommentElements(comment.x, comment.y);
      this._scrollCommentsToBottom(comment.x, comment.y);
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
            comment: this._htmlLineBreaks(comment),
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
    
    _getModalChildCommentsData: function (rootCommentId) {
      return _.map(this._childComments[rootCommentId], (childComment, index) =>  {
        return Object.assign(childComment, {
          comment: this._htmlLineBreaks(childComment.comment),
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
    
    _onExpandCommentsClick: function (event) {
      const comments = $(event.target).closest('.comments');
      comments.attr({
        'data-original-width': comments.css('width'),
        'data-original-height': comments.css('height')
      });
              
      $('.comments').hide();
      
      comments
        .css({
          width: '100%',
          height: '80vh'
        })
        .addClass('expanded')
        .show();
    },
    
    _onUnexpandCommentsClick: function (event) {
      const comments = $(event.target).closest('.comments');
      
      comments.css({
        width: comments.attr('data-original-width'),
        height: comments.attr('data-original-height')
      });
      
      $('.comments')
        .removeClass('expanded')
        .show();
    },
    
    _onWindowResize: function () {
      this._refreshLabels();
    }
    
  });
  
  $(document).ready(() => {
    $('.comments-container').queryLiveComments();
  });
  
})();
