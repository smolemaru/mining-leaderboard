#!/bin/bash

echo "Setting up Mining Leaderboard Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js (v16+) and try again."
    exit 1
fi

# Check node version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "Warning: You're using Node.js v$NODE_VERSION. This application recommends Node.js v16 or higher."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Start the server
echo "Starting the server..."
node server.js 