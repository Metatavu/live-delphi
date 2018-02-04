/* jshint esversion: 6 */
/* global getConfig, bootbox, moment */

(function(){
  'use strict';
  
  $('input[name="accessCodes"]').on('itemAdded', function(event) {
    const accessCodes = $('input[name="accessCodes"]').val();
    window.location.replace('/queries?accessCodes='+accessCodes);
  });
  
})();