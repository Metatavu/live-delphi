/* jshint esversion: 6 */
/* global getConfig, bootbox */
(function(){
  'use strict';
  
  $(document).ready(() => {
    $('input[data-type="date-time"]').flatpickr({
      "locale": "fi",
      "altFormat": "d.m.Y H:i",
      "altInput": true,
      "utc": true,
      "allowInput": false,
      "enableTime" : true,
      "time_24hr": true
    });
    
    $('form').submit((event) => {
      event.preventDefault();
      const form = $(event.target);
      const data = form.serialize();

      $.ajax({
        url: '/manage/queries/create',
        data: data,
        method: 'POST',
        success: () => {
          bootbox.alert({
            message: '<p><i class="fa fa-check" /> Kysely luotiin onnistuneesti.</p>',
            backdrop: true,
            callback: () => {
              window.location.reload(true);
            }
          });
        },
        error: (jqXHR, textStatus) => {
          const errorMessage = textStatus ? jqXHR.responseText || jqXHR.statusText || textStatus : null;
          $('<div>')
            .addClass('alert alert-danger fixed-top')
            .text('Kyselyn luonti epäonnistui: ' + errorMessage)
            .appendTo(document.body);        
        }
        
      });
    });
  });
  
})();
