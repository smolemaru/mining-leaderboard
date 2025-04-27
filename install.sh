#!/bin/bash

echo "Installing and setting up BIGCOIN Mining Leaderboard..."

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

# Make setup.sh executable
chmod +x backend/setup.sh

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
echo "Backend dependencies installed successfully!"
cd ..

# Instructions for running the application
echo
echo "Installation complete! To run the application:"
echo
echo "1. Start the backend server:"
echo "   cd backend"
echo "   node server.js"
echo
echo "2. Open frontend/index.html in your browser"
echo
echo "Or use the setup scripts:"
echo "   ./backend/setup.sh - To start the backend server"
echo 