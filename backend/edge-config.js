/**
 * Edge Config helper module for Mining Leaderboard
 * 
 * This module handles interactions with Vercel Edge Config,
 * with fallbacks for local development or when Edge Config is not available.
 */

const { createClient } = require('@vercel/edge-config');

// Local storage to use as fallback when Edge Config is not available
let localLeaderboardCache = null;

/**
 * Initialize Edge Config client if environment variable is set
 */
function initEdgeConfig() {
  // Check if the EDGE_CONFIG environment variable is set
  if (!process.env.EDGE_CONFIG) {
    console.warn('EDGE_CONFIG environment variable is not set. Edge Config features will be disabled.');
    return null;
  }
  
  try {
    const client = createClient(process.env.EDGE_CONFIG);
    console.log('Edge Config client initialized successfully');
    return client;
  } catch (error) {
    console.error('Failed to initialize Edge Config client:', error.message);
    return null;
  }
}

// Initialize the Edge Config client
const edgeConfigClient = initEdgeConfig();

/**
 * Saves leaderboard data to Edge Config
 * Falls back to local cache if Edge Config is not available
 * 
 * @param {Object} leaderboardData - The leaderboard data to save
 * @returns {Promise<boolean>} - Success status
 */
async function saveLeaderboardData(leaderboardData) {
  // Add timestamp
  const dataToSave = {
    ...leaderboardData,
    lastSaved: new Date().toISOString()
  };
  
  // Save to local cache first
  localLeaderboardCache = dataToSave;
  
  // If Edge Config is not available, return successfully with local cache only
  if (!edgeConfigClient) {
    console.log('Edge Config not available, saved to local cache only');
    return true;
  }
  
  try {
    await edgeConfigClient.set('leaderboardData', dataToSave);
    console.log('Leaderboard data saved to Edge Config successfully');
    return true;
  } catch (error) {
    console.error('Failed to save leaderboard data to Edge Config:', error.message);
    console.log('Using local cache as fallback');
    return false;
  }
}

/**
 * Retrieves leaderboard data from Edge Config
 * Falls back to local cache if Edge Config is not available or fails
 * 
 * @returns {Promise<Object|null>} - The leaderboard data or null if not found
 */
async function getLeaderboardData() {
  // If Edge Config is not available, return local cache
  if (!edgeConfigClient) {
    console.log('Edge Config not available, using local cache');
    return localLeaderboardCache;
  }
  
  try {
    const data = await edgeConfigClient.get('leaderboardData');
    
    if (!data) {
      console.log('No leaderboard data found in Edge Config, using local cache');
      return localLeaderboardCache;
    }
    
    console.log('Leaderboard data retrieved from Edge Config successfully');
    // Update local cache with the latest data
    localLeaderboardCache = data;
    return data;
  } catch (error) {
    console.error('Failed to retrieve leaderboard data from Edge Config:', error.message);
    console.log('Using local cache as fallback');
    return localLeaderboardCache;
  }
}

/**
 * Checks if Edge Config is properly configured and accessible
 * 
 * @returns {Promise<boolean>} - Whether Edge Config is working properly
 */
async function isEdgeConfigWorking() {
  if (!edgeConfigClient) {
    return false;
  }
  
  try {
    // Try to read a test value
    await edgeConfigClient.get('test');
    return true;
  } catch (error) {
    console.error('Edge Config health check failed:', error.message);
    return false;
  }
}

/**
 * Gets Edge Config status information
 * 
 * @returns {Object} - Status information
 */
function getEdgeConfigStatus() {
  return {
    available: !!edgeConfigClient,
    envVarSet: !!process.env.EDGE_CONFIG,
    localCacheAvailable: !!localLeaderboardCache
  };
}

module.exports = {
  saveLeaderboardData,
  getLeaderboardData,
  isEdgeConfigWorking,
  getEdgeConfigStatus
}; 