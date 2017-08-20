/* jshint esversion: 6 */
/* global getConfig, bootbox, moment */

(function(){
  'use strict';
  
  $(document).on("click", ".delete-query", (event) => {
    const queryId = $(event.target).attr('data-query-id');
    const queryName = $(event.target)
      .closest('.list-group-item')
      .find('.query-name')
      .text();
    
    bootbox.confirm({
      message: '<p><i class="fa fa-exclamation-triangle" /> Haluatko varmasti poistaa kyselyn <i>' + queryName + '</i>?</p>',
      backdrop: true,
      buttons: {
       confirm: {
         label: 'Poista',
         className: 'btn-danger'
       },
       cancel: {
         label: 'Peruuta'
       }
      },
      callback: (confirm) => {
        if (confirm) {
          $.ajax({
            url: '/manage/queries/delete?id=' + queryId,
            method: 'DELETE',
            success: () => {
              window.location.href = '/manage/queries';
            },
            error: (jqXHR, textStatus) => {
              const errorMessage = textStatus ? jqXHR.responseText || jqXHR.statusText || textStatus : null;
              $('<div>')
                .addClass('alert alert-danger fixed-top')
                .text('Kyselyn poisto epäonnistui: ' + errorMessage)
                .appendTo(document.body);        
            }

          });
        }
      }
    });
  });
  
  $(document).on("click", ".delete-query-data", (event) => {
    const queryId = $(event.target).attr('data-query-id');
    const queryName = $(event.target)
      .closest('.list-group-item')
      .find('.query-name')
      .text();
    
    bootbox.confirm({
      message: '<p><i class="fa fa-exclamation-triangle" /> Haluatko varmasti poistaa kyselyn <i>' + queryName + '</i> -datat?</p>',
      backdrop: true,
      buttons: {
       confirm: {
         label: 'Poista',
         className: 'btn-danger'
       },
       cancel: {
         label: 'Peruuta'
       }
      },
      callback: (confirm) => {
        if (confirm) {
          $.ajax({
            url: '/manage/queries/deleteData?id=' + queryId,
            method: 'DELETE',
            success: () => {
              const alertElement = $('<div>')
                .addClass('alert alert-success fixed-top')
                .text('Kyselyn datojen poisto onnistui!')
                .appendTo(document.body);
              setTimeout(() => {
                alertElement.hide("fade", {}, 300, () => {
                  alertElement.remove();
                });
              }, 3000);
            },
            error: (jqXHR, textStatus) => {
              const errorMessage = textStatus ? jqXHR.responseText || jqXHR.statusText || textStatus : null;
              $('<div>')
                .addClass('alert alert-danger fixed-top')
                .text('Kyselyn datojen poisto epäonnistui: ' + errorMessage)
                .appendTo(document.body);        
            }

          });
        }
      }
    });
  });
  
})();
