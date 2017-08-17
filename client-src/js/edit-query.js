/* jshint esversion: 6 */
/* global getConfig, bootbox, moment */

(function(){
  'use strict';
  
  $(document).ready(() => {
    $('input[data-type="color"]').colorpicker({
       sliders: { 
         saturation: { 
           maxLeft: 200, 
           maxTop: 200 
         }, 
         hue: { 
           maxTop: 200 
         }, 
         alpha: { 
           maxTop: 200 
         } 
      }
    });
    
    $('input[data-type="date-time"]').flatpickr({
      "locale": "fi",
      "altFormat": "LLL",
      "format": "ISO",
      "altInput": true,
      "utc": false,
      "allowInput": false,
      "enableTime" : true,
      "time_24hr": true,
      "parseDate": (value) => {
        if (value) {
          var intValue = parseInt(value);
          if (intValue) {
            return new Date(intValue);
          }
        }
        
        return null;
      },
      "formatDate": (dateObj, format) => {
        if (format === 'LLL') {
          return moment(dateObj)
            .locale("fi")
            .format('LLL');
        } else {
          return dateObj.getTime();
        }
      }
    });
    
    $('form').submit((event) => {
      event.preventDefault();
      const form = $(event.target);
      const data = form.serialize();

      $.ajax({
        url: '/manage/queries/edit',
        data: data,
        method: 'PUT',
        success: () => {
          bootbox.alert({
            message: '<p><i class="fa fa-check" /> Kysely tallennettiin onnistuneesti.</p>',
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
            .text('Kyselyn muokkaus epäonnistui: ' + errorMessage)
            .appendTo(document.body);        
        }
        
      });
    });
  });
  
})();
