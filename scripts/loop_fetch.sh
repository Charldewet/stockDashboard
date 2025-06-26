#!/bin/bash
while true; do
  echo "=== Running fetch_latest.py at $(date) ==="
  python3 scripts/fetch_latest.py
  sleep 60
done 