const options = require(__dirname + '/options');
  
module.exports = [
  "../shady-messages",
  {
    "packagePath": "../shady-cassandra",
    "keyscape": 'livedelphi'
  },
  "../shady-websockets",
  "../shady-worker",
  "./plugins/live-delphi-models"
];