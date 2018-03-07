/* jshint esversion: 6 */
/* global getConfig, bootbox */
(() => {
  'use strict';
  
  $(document).ready(() => {
    $('.create-query-folder').click((e) => {
      e.preventDefault();

      const name = $('.new-query-folder-form').find('input[name="name"]').val();
      const accessCode = $('.new-query-folder-form').find('input[name="accessCode"]').val();
      
      $.post('/manage/queryfolders', {name: name, accessCode: accessCode}, (queryFolder) => {
        $('.folders-table').find('tbody').prepend(pugQueryFolderRow({
          queryFolder: queryFolder
        }));
      }).fail(() => {
        alert('Failed to create query folder');
      });
    });
  });
  
})();
