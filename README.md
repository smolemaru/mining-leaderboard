# BIGCOIN Mining Leaderboard

A blockchain-based mining leaderboard application that displays miner statistics from the BIGCOIN contract.

## Features

- Real-time blockchain data from the BIGCOIN contract
- Responsive UI with Bootstrap 5
- Auto-refresh functionality (every 2 minutes)
- Fallback to mock data when blockchain connection is unavailable
- Explorer links for each miner address
- **NEW!** Game room integration with direct linking to a miner's game room
- **NEW!** Detailed miner information view
- **NEW!** Highlighting of specific miners when accessed via wallet address URL
- **NEW!** Serverless deployment with Vercel

## Architecture

- **Frontend**: HTML/CSS/JavaScript with Bootstrap 5
- **Backend**: Node.js with Express.js
- **Blockchain Connection**: ABS.XYZ API
- **Deployment**: Vercel serverless functions

## Prerequisites

- Node.js (v16+)
- npm or yarn
- GitHub account (for deployment)
- Vercel account (for production deployment)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/mining-leaderboard.git
   cd mining-leaderboard
   ```

2. Install backend dependencies:
   ```
   cd backend
   npm install
   ```

## Running the Application

### Standard Development Setup

#### Backend Server

1. Start the backend server:
   ```
   cd backend
   npm start
   ```
   
   This will start the server at http://localhost:3000

2. The server will automatically attempt to connect to the blockchain and retrieve leaderboard data.
   If the connection fails, it will use mock data as a fallback.

#### Frontend

There are two ways to access the frontend:

1. **Through the backend server**:
   - After starting the backend server, visit http://localhost:3000
   - This will serve a basic API documentation page

2. **Directly using the frontend files**:
   - Open `mining-leaderboard/frontend/index.html` in your browser
   - The frontend will automatically connect to the backend server at http://localhost:3000

### Production Deployment (Vercel)

For production deployment, we use Vercel for serverless hosting:

1. Push your code to GitHub
2. Connect your Vercel account to your GitHub repository
3. Deploy with a single click - Vercel automatically configures everything

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Game Room Feature

The new game room feature allows you to:

1. **View a specific miner's details**:
   - Click on the "Details" button next to any miner to see more information
   - The details panel will show address, hashrate, and rank

2. **Open a miner's game room**:
   - Click on the "Game Room" button next to any miner 
   - This will open the BIGCOIN game room for that wallet address

3. **Direct linking to a specific miner**:
   - You can link directly to a specific miner's view using the format:
   - `https://www.bigcoin.tech/room/0x123...abc`
   - When opened, the specified miner will be highlighted and their details shown automatically

## API Endpoints

- **GET /api/leaderboard**: Returns the current leaderboard data
  ```json
  {
    "leaderboard": [
      {
        "address": "0x1234...",
        "hashrate": "5000000",
        "hashrateNum": 5000000
      },
      ...
    ],
    "lastUpdate": "2023-05-15T12:34:56.789Z"
  }
  ```

- **GET /api/health**: Returns the API health status
  ```json
  {
    "status": "ok",
    "blockchain": "connected",
    "contract": "0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705",
    "miners": 26,
    "lastUpdate": "2023-05-15T12:34:56.789Z"
  }
  ```

- **POST /api/mock/update-hashrate**: Simulate hashrate updates (for testing)
  ```json
  {
    "address": "0x1234...",
    "hashrate": "5500000"
  }
  ```

## Contract Details

- **Contract Address**: 0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705
- **RPC URL**: https://api.mainnet.abs.xyz

## Development Notes

- The backend will automatically use mock data if it cannot connect to the blockchain
- Leaderboard data is updated every 2 minutes
- The frontend will show both real blockchain data and mock data (if the backend is unavailable)
- The URL format for game rooms is: `https://www.bigcoin.tech/room/{wallet_address}`
- Environment variables can be configured in the `env.example` file (copy to `.env` for local development)

## Troubleshooting

1. **Cannot connect to blockchain**:
   - Check your internet connection
   - Verify that the RPC URL is accessible
   - The application will use mock data as a fallback

2. **Frontend cannot connect to backend**:
   - Ensure the backend server is running on port 3000
   - Check for any CORS issues in the browser console
   - The frontend has a built-in mock data option if the backend is unreachable

3. **Miner not found in the list**:
   - If accessing via wallet address URL and the miner isn't found, the app will add them to the mock data list
   - Check that the wallet address is correct and properly formatted
   - The address should be a valid Ethereum address (0x followed by 40 hex characters)

4. **Vercel deployment issues**:
   - Check build logs in the Vercel dashboard
   - Ensure environment variables are properly configured
   - Verify that your `vercel.json` configuration is correct

## License

© 2023 BIGCOIN - All rights reserved 