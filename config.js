module.exports = [
  "../shady-messages",
  {
    "packagePath": "../shady-cassandra",
    "keyscape": 'livedelphi'
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
  "../shady-websockets",
  "../shady-worker",
  "./plugins/live-delphi-models"
];