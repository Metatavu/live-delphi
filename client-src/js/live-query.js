(function(){
  'use strict';
  
  $.widget("custom.queryLiveChart", { 
    _create : function() {
      const port = window.location.port;
      const host = window.location.hostname;
      const secure = window.location.protocol === 'https:';
      const wsSession = this.element.attr('data-ws-session');
      const wsProtocol = secure ? 'wss' : 'ws';
      const wsUrl = wsProtocol + '://' + host + ':' + port;
      
      this.element.liveDelphiClient({
        wsUrl: wsUrl
      });
      
      this.element.on('connect', $.proxy(this._onConnect, this));
      this.element.on('message:answer-changed', $.proxy(this._onMessageAnswerChanged, this));
      
      this.element.liveDelphiClient('connect', wsSession);
    },
    
    _onConnect: function (event, data) {
      this.element.liveDelphiChart();      
      this._joinQuery();
    },
    
    _joinQuery: function () {      
      this.element.liveDelphiClient('sendMessage', {
        'type': 'join-query'
      });
    },
    
    _onMessageAnswerChanged: function (event, data) {
      this.element.liveDelphiChart('userData', data.userHash, {
        x: data.x,
        y: data.y
      });
    }
    
  });
  
  $(document).ready(() => {
    $("#chart").queryLiveChart();
  });
  
})();
