const express = require('express');
const router = express.Router();
const blockchainService = require('../services/blockchain');

// Get the leaderboard data
router.get('/', async (req, res) => {
  try {
    // Check if we need to update the leaderboard (if not updated recently)
    const now = Date.now();
    const dataAge = now - blockchainService.lastUpdateTime;
    const isDataRecent = dataAge < 5 * 60 * 1000; // 5 minutes in milliseconds
    
    let data;
    
    // If data is not recent, try to update it
    if (!isDataRecent) {
      try {
        console.log('Data is stale, updating leaderboard...');
        data = await blockchainService.updateLeaderboard();
      } catch (updateError) {
        console.error('Error updating leaderboard:', updateError.message);
        // Continue with current data if available
        data = blockchainService.leaderboardData;
      }
    } else {
      // Use cached data
      data = blockchainService.leaderboardData;
    }

    // Add status information to the response
    const response = {
      ...data,
      status: {
        blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        lastUpdate: new Date(blockchainService.lastUpdateTime).toISOString(),
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
        blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        lastUpdate: blockchainService.lastUpdateTime ? new Date(blockchainService.lastUpdateTime).toISOString() : null
      }
    });
  }
});

// Force refresh the leaderboard data
router.post('/refresh', async (req, res) => {
  try {
    // Call the updateLeaderboard function to force a refresh
    console.log('Force refreshing leaderboard data...');
    const refreshedData = await blockchainService.updateLeaderboard(true); // Pass true to force refresh
    
    // Return the refreshed data with status
    res.json({
      ...refreshedData,
      status: {
        blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        lastUpdate: new Date(blockchainService.lastUpdateTime).toISOString()
      }
    });
  } catch (error) {
    console.error('Error refreshing leaderboard data:', error);
    res.status(500).json({
      error: 'Failed to refresh leaderboard data',
      message: error.message,
      status: {
        blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        lastUpdate: blockchainService.lastUpdateTime ? new Date(blockchainService.lastUpdateTime).toISOString() : null
      }
    });
  }
});

module.exports = router; 