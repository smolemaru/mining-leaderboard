/**
 * Edge Config helper module for Mining Leaderboard
 * Provides functionality to store and retrieve leaderboard data using Vercel Edge Config
 */

const { createClient } = require('@vercel/edge-config');

// Create Edge Config client
// This will automatically use the EDGE_CONFIG environment variable set in Vercel
let edgeConfig;
try {
  edgeConfig = createClient(process.env.EDGE_CONFIG);
  console.log('Edge Config client initialized');
} catch (error) {
  console.error('Error initializing Edge Config client:', error.message);
  console.log('Will fall back to in-memory storage');
  edgeConfig = null;
}

/**
 * Store leaderboard data in Edge Config
 * @param {Object} data - The leaderboard data to store
 * @returns {Promise<boolean>} - Whether the storage was successful
 */
async function storeLeaderboardData(data) {
  if (!edgeConfig) {
    console.log('Edge Config not available, skipping storage');
    return false;
  }

  try {
    // Store the data with the key 'leaderboard'
    await edgeConfig.set('leaderboard', data);
    console.log('Leaderboard data stored in Edge Config');
    
    // Also store the last update time for tracking
    await edgeConfig.set('lastUpdate', new Date().toISOString());
    return true;
  } catch (error) {
    console.error('Error storing data in Edge Config:', error.message);
    return false;
  }
}

/**
 * Get leaderboard data from Edge Config
 * @returns {Promise<Object|null>} - The leaderboard data or null if not available
 */
async function getLeaderboardData() {
  if (!edgeConfig) {
    console.log('Edge Config not available, returning null');
    return null;
  }

  try {
    // Get the data with the key 'leaderboard'
    const data = await edgeConfig.get('leaderboard');
    console.log('Retrieved leaderboard data from Edge Config');
    return data;
  } catch (error) {
    console.error('Error retrieving data from Edge Config:', error.message);
    return null;
  }
}

/**
 * Get last update time from Edge Config
 * @returns {Promise<string|null>} - ISO timestamp of last update or null
 */
async function getLastUpdateTime() {
  if (!edgeConfig) {
    return null;
  }

  try {
    return await edgeConfig.get('lastUpdate');
  } catch (error) {
    console.error('Error retrieving last update time:', error.message);
    return null;
  }
}

/**
 * Check if Edge Config is available and working
 * @returns {Promise<boolean>} - Whether Edge Config is available
 */
async function isEdgeConfigAvailable() {
  if (!edgeConfig) {
    return false;
  }

  try {
    // Try a simple operation to check if Edge Config is working
    await edgeConfig.has('lastUpdate');
    return true;
  } catch (error) {
    console.error('Edge Config availability check failed:', error.message);
    return false;
  }
}

module.exports = {
  storeLeaderboardData,
  getLeaderboardData,
  getLastUpdateTime,
  isEdgeConfigAvailable
}; 