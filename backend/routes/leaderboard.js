const express = require('express');
const router = express.Router();
const blockchainService = require('../services/blockchain');
const edgeConfig = require('../edge-config');

// Get the leaderboard data
router.get('/', async (req, res) => {
  try {
    // Check if we need to update the leaderboard (if not updated recently)
    const now = Date.now();
    const dataAge = now - blockchainService.lastUpdateTime;
    const isDataRecent = dataAge < 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // If data is not recent, trigger an update
    if (!isDataRecent) {
      try {
        console.log('Data is stale, updating leaderboard...');
        const updateResult = await blockchainService.updateLeaderboard();
        if (!updateResult.success) {
          console.error('Error updating leaderboard:', updateResult.error);
        }
      } catch (updateError) {
        console.error('Error updating leaderboard:', updateError.message);
      }
    }
    
    // Always get the latest data from the service
    const data = blockchainService.leaderboardData;
    console.log('Using leaderboard data:', {
      minersCount: data?.miners?.length || 0,
      totalHashrate: data?.totalHashrate || '0',
      hasStatus: !!data?.status
    });

    // Log current blockchain status
    console.log(`Current blockchain status: ${blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected'}`);

    // Get Edge Config status
    const edgeConfigStatus = edgeConfig.getEdgeConfigStatus();
    const isEdgeConfigWorking = await edgeConfig.isEdgeConfigWorking();

    // Ensure data has the required structure and is valid
    if (!data || !data.miners || !Array.isArray(data.miners)) {
      throw new Error('Invalid or missing leaderboard data structure');
    }

    const responseData = {
      miners: data.miners,
      totalHashrate: data.totalHashrate || '0',
      status: {
        blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: isEdgeConfigWorking ? 'configured' : 'not_working',
        lastUpdate: new Date(blockchainService.lastUpdateTime).toISOString(),
        dataAge: Math.round(dataAge / 1000) // Age in seconds
      }
    };

    // Detailed debug logging
    console.log('Response data structure check:', {
      hasMinersProp: 'miners' in responseData,
      minersIsArray: Array.isArray(responseData.miners),
      minersLength: responseData.miners?.length || 0,
      totalHashrate: responseData.totalHashrate,
      hasStatus: !!responseData.status
    });

    res.json(responseData);
  } catch (error) {
    console.error('Error in leaderboard API:', error);
    
    // Get Edge Config status even in error case
    const edgeConfigStatus = edgeConfig.getEdgeConfigStatus();
    let isEdgeConfigWorking = false;
    
    try {
      isEdgeConfigWorking = await edgeConfig.isEdgeConfigWorking();
    } catch (e) {
      console.error('Failed to check Edge Config status:', e);
    }

    // Try to get any available data from the service
    const fallbackData = blockchainService.leaderboardData;
    
    // If we have valid fallback data, return it with error status
    if (fallbackData && fallbackData.miners && Array.isArray(fallbackData.miners)) {
      res.status(200).json({
        miners: fallbackData.miners,
        totalHashrate: fallbackData.totalHashrate || '0',
        status: {
          blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
          edgeConfig: isEdgeConfigWorking ? 'configured' : 'not_working',
          lastUpdate: blockchainService.lastUpdateTime ? new Date(blockchainService.lastUpdateTime).toISOString() : null,
          error: error.message
        }
      });
    } else {
      // If no valid data is available, return error response
      res.status(500).json({
        error: 'Failed to retrieve leaderboard data',
        message: error.message,
        status: {
          blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
          edgeConfig: isEdgeConfigWorking ? 'configured' : 'not_working',
          lastUpdate: blockchainService.lastUpdateTime ? new Date(blockchainService.lastUpdateTime).toISOString() : null
        }
      });
    }
  }
});

// Force refresh the leaderboard data
router.post('/refresh', async (req, res) => {
  try {
    // Call the updateLeaderboard function to force a refresh
    console.log('Force refreshing leaderboard data...');
    const updateResult = await blockchainService.updateLeaderboard(true);
    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to refresh leaderboard data');
    }
    
    // Get the latest data from the service
    const data = blockchainService.leaderboardData;
    
    // Get Edge Config status
    const edgeConfigStatus = edgeConfig.getEdgeConfigStatus();
    const isEdgeConfigWorking = await edgeConfig.isEdgeConfigWorking();
    
    // Ensure data has the required structure and is valid
    if (!data || !data.miners || !Array.isArray(data.miners)) {
      throw new Error('Invalid or missing leaderboard data structure after refresh');
    }
    
    // Return the refreshed data with status
    res.json({
      miners: data.miners,
      totalHashrate: data.totalHashrate || '0',
      status: {
        blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: isEdgeConfigWorking ? 'configured' : 'not_working',
        lastUpdate: new Date(blockchainService.lastUpdateTime).toISOString()
      }
    });
  } catch (error) {
    console.error('Error refreshing leaderboard data:', error);
    
    // Get Edge Config status even in error case
    const edgeConfigStatus = edgeConfig.getEdgeConfigStatus();
    let isEdgeConfigWorking = false;
    
    try {
      isEdgeConfigWorking = await edgeConfig.isEdgeConfigWorking();
    } catch (e) {
      console.error('Failed to check Edge Config status:', e);
    }

    // Try to get any available data from the service
    const fallbackData = blockchainService.leaderboardData;
    
    // If we have valid fallback data, return it with error status
    if (fallbackData && fallbackData.miners && Array.isArray(fallbackData.miners)) {
      res.status(200).json({
        miners: fallbackData.miners,
        totalHashrate: fallbackData.totalHashrate || '0',
        status: {
          blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
          edgeConfig: isEdgeConfigWorking ? 'configured' : 'not_working',
          lastUpdate: blockchainService.lastUpdateTime ? new Date(blockchainService.lastUpdateTime).toISOString() : null,
          error: error.message
        }
      });
    } else {
      // If no valid data is available, return error response
      res.status(500).json({
        error: 'Failed to refresh leaderboard data',
        message: error.message,
        status: {
          blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
          edgeConfig: isEdgeConfigWorking ? 'configured' : 'not_working',
          lastUpdate: blockchainService.lastUpdateTime ? new Date(blockchainService.lastUpdateTime).toISOString() : null
        }
      });
    }
  }
});

module.exports = router; 