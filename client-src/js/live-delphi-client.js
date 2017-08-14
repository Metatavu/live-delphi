/* jshint esversion: 6 */
/* global window, document, WebSocket, MozWebSocket, $, _*/
(() => {
  'use strict';
  
  $.widget("custom.liveDelphiClient", {
    
    options: {
      wsUrl: 'ws://localhost:8000',
      reconnectTimeout: 3000
    },
    
    _create : function () {
      this._state = null;
      this._pendingMessages = [];
    },
    
    connect: function (sessionId) {
      this._state = 'CONNECTING';
      
      this._webSocket = this._createWebSocket(sessionId);
      if (!this._webSocket) {
        // Handle error  
        return;
      } 
      
      switch (this._webSocket.readyState) {
        case this._webSocket.CONNECTING:
          this._webSocket.onopen = $.proxy(this._onWebSocketOpen, this);
        break;
        case this._webSocket.OPEN:
          this._onWebSocketOpen();
        break;
        default:
          this._reconnect();
        break;
      }
      
      this._webSocket.onmessage = $.proxy(this._onWebSocketMessage, this);
      this._webSocket.onclose = $.proxy(this._onWebSocketClose, this);
      this._webSocket.onerror = $.proxy(this._onWebSocketError, this);
    },
    
    sendMessage: function (data) {
      this._sendMessage(data);
    },
    
    _reconnect: function () {
      console.log("Reconnecting...");

      if (this._reconnectTimeout) {
        clearTimeout(this._reconnectTimeout);
      }
      
      if (!this._webSocket || this._webSocket.readyState !== this._webSocket.CONNECTING) {
        this.connect();
      }
      
      this._reconnectTimeout = setTimeout(() => {
        console.log("timeout socket state: " + this._webSocket.readyState);
        
        if (this._webSocket.readyState === this._webSocket.CLOSED) {
          this._reconnect();
        }
      }, this.options.reconnectTimeout);
    },

    _createWebSocket: function (sessionId) {
      const url = this.options.wsUrl + '/' + sessionId;
      if ((typeof window.WebSocket) !== 'undefined') {
        return new WebSocket(url);
      } else if ((typeof window.MozWebSocket) !== 'undefined') {
        return new MozWebSocket(url);
      }
    },
    
    _sendMessage: function (data) {
      const message = JSON.stringify(data);
      
      if (this._state === 'CONNECTED') {
        this._webSocket.send(message);
      } else {
        this._pendingMessages.push(message);
      }
    },
    
    _onWebSocketOpen: function (event) {
      while (this._pendingMessages.length) {
        this._webSocket.send(this._pendingMessages.shift());
      }
      
      this._state = 'CONNECTED';
      
      this.element.trigger("connect", { }); 
      
      console.log("Connected");
    },
    
    _onWebSocketMessage: function (event) {
      const message = JSON.parse(event.data);
      this.element.trigger("message:" + message.type, message.data); 
    },
    
    _onWebSocketClose: function (event) {
      console.log("Socket closed");
      this._reconnect();
    },
    
    _onWebSocketError: function (event) {
      console.log("Socket error");
      this._reconnect();
    }
    
  });
  
})();