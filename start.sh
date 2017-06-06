#!/bin/bash

INITIAL_WORKERS=$1
WORKER_COUNT=0
PORT=3001
while [[ $WORKER_COUNT -lt $INITIAL_WORKERS ]]; do
  let WORKER_COUNT=WORKER_COUNT+1 
  let PORT=PORT+1
  node app.js --host localhost --port $PORT &  
done

KEY='0'
PIDS=$(jobs -pr);
  
while [[ "$KEY" != "q" ]]; do
  clear
  echo "Enter command:"
  echo ""

  PIDS=$(jobs -pr);
  I=1
  for pid in $PIDS; do
    echo "$I) to terminate worker in pid: $pid"
    let I=I+1
  done
  
  echo n to spawn new worker
  echo q to quit
  
  read KEY
  
  if [[ "$KEY" == 'n' ]]; then
    let WORKER_COUNT=WORKER_COUNT+1 
    let PORT=PORT+1
    node app.js --host localhost --port $PORT &
  else
    if [[ $KEY -le $WORKER_COUNT ]]; then
      I=1
      for pid in $PIDS; do
        if [[ $KEY = $I ]]; then
          kill $pid
          wait $pid
        fi
        let I=I+1
      done
    fi
  fi
done;

PIDS=$(jobs -pr);
for pid in $PIDS; do
  kill $pid
  wait $pid
done
