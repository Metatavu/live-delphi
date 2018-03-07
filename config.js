const config = require('nconf');

module.exports = [
  {
    "packagePath": "shady-messages",
    "amqpUrl": config.get('amqp:url')
  },
  {
    "packagePath": "shady-sequelize",
    "host": config.get('mysql:host'),
    "database": config.get('mysql:database'),
    "username": config.get('mysql:username'),
    "password": config.get('mysql:password'),
    "dialect": "mysql"
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
  "./plugins/live-delphi-routes",
  "./plugins/live-delphi-ws-messages",
  "./plugins/live-delphi-data-export",
  "./plugins/live-delphi-access-control",
  "./plugins/live-delphi-user-management",
  "./plugins/live-delphi-resource-management",
  "./plugins/live-delphi-charts",
  "./plugins/live-delphi-analysis",
  "./plugins/live-delphi-pdf"
];