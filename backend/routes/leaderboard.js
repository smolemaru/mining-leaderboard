const express = require('express');
const router = express.Router();

// Import any necessary services, likely from blockchain or database services
const { isConnectedToBlockchain, leaderboardData, lastUpdateTime } = require('../services/blockchain');

// Get the leaderboard data
router.get('/', async (req, res) => {
  try {
    // If leaderboard data exists and is recent (less than 5 minutes old)
    const currentTime = Date.now();
    const dataAge = currentTime - lastUpdateTime;
    const isDataRecent = dataAge < 5 * 60 * 1000; // 5 minutes in milliseconds

    // Add status information to the response
    const response = {
      ...leaderboardData,
      status: {
        blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        lastUpdate: new Date(lastUpdateTime).toISOString(),
        dataAge: Math.round(dataAge / 1000) // Age in seconds
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error in leaderboard API:', error);
    res.status(500).json({
      error: 'Failed to retrieve leaderboard data',
      message: error.message,
      status: {
        blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        lastUpdate: lastUpdateTime ? new Date(lastUpdateTime).toISOString() : null
      }
    });
  }
});

// Force refresh the leaderboard data
router.post('/refresh', async (req, res) => {
  try {
    // Call the updateLeaderboard function to force a refresh
    const blockchainService = require('../services/blockchain');
    const refreshedData = await blockchainService.updateLeaderboard(true); // Pass true to force refresh
    
    // Return the refreshed data with status
    res.json({
      ...refreshedData,
      status: {
        blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        lastUpdate: new Date(lastUpdateTime).toISOString()
      }
    });
  } catch (error) {
    console.error('Error refreshing leaderboard data:', error);
    res.status(500).json({
      error: 'Failed to refresh leaderboard data',
      message: error.message,
      status: {
        blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        lastUpdate: lastUpdateTime ? new Date(lastUpdateTime).toISOString() : null
      }
    });
  }
});

module.exports = router; 