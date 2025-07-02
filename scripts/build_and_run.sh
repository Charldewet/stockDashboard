#!/bin/bash

# Build the React app first
echo "Building React app..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "React app built successfully!"
    echo "Starting Flask server..."
    # Start the Flask app
    python3 -m flask --app app run --host=0.0.0.0 --port=5000
else
    echo "Failed to build React app!"
    exit 1
fi 