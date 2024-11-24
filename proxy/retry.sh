#!/bin/bash

while true; do
  echo "Starting Deno server..."
  deno run --allow-net index.ts

  echo "Deno server exited. Restarting in 5 seconds..."
  sleep 5
done