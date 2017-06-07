const config = require('nconf');

module.exports = [
  "shady-messages",
  {
    "packagePath": "shady-cassandra",
    "keyscape": 'livedelphi',
    "contactPoints": config.get('cassandra:contact-points')
  },
  {
    "packagePath": "architect-logger",
    "exitOnError": false,
    "transports": {
      "console": {
        "colorize": true,
        "level": "verbose"
      }
    }
  },
  "shady-websockets",
  "shady-worker",
  "./plugins/live-delphi-models",
  "./plugins/live-delphi-routes"
];