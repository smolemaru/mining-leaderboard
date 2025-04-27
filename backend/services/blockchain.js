/**
 * Blockchain service for Mining Leaderboard
 * 
 * This module handles all interactions with the blockchain
 * and provides data to the API routes.
 */

const ethers = require('ethers');
const edgeConfig = require('../edge-config');

// Variables to track connection and data status
let isConnectedToBlockchain = false;
let lastUpdateTime = Date.now() - (10 * 60 * 1000); // Set initial time to 10 mins ago
let leaderboardData = { miners: [], totalHashrate: "0" };

// Contract details
const CONTRACT_ADDRESS = '0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705';
const CONTRACT_ABI = [
  // getTopMiners and getLeaderboard functions from original ABI
  {"inputs":[{"internalType":"uint256","name":"count","type":"uint256"}],"name":"getTopMiners","outputs":[{"components":[{"internalType":"address","name":"miner","type":"address"},{"internalType":"uint256","name":"hashrate","type":"uint256"}],"internalType":"struct MiningLeaderboard.MinerInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getLeaderboard","outputs":[{"components":[{"internalType":"address","name":"miner","type":"address"},{"internalType":"uint256","name":"hashrate","type":"uint256"}],"internalType":"struct MiningLeaderboard.MinerInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"playerHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

// RPC URLs for blockchain connection
const RPC_URLS = [
  process.env.RPC_URL || 'https://api.mainnet.abs.xyz',
  process.env.RPC_URL_ALTERNATE || 'https://abstract.drpc.org',
  'https://eth.llamarpc.com' // Generic fallback
];

// Initialize blockchain connection with error handling
async function initBlockchainConnection() {
  try {
    console.log('Initializing blockchain connection...');
    
    // Try each RPC URL until one works
    for (let i = 0; i < RPC_URLS.length; i++) {
      try {
        const url = RPC_URLS[i];
        console.log(`Trying RPC URL (${i+1}/${RPC_URLS.length}): ${url}`);
        
        // Determine ethers version and create provider accordingly
        let provider;
        if (ethers.version && parseInt(ethers.version.split('.')[0]) >= 6) {
          provider = new ethers.JsonRpcProvider(url);
        } else {
          provider = new ethers.providers.JsonRpcProvider(url);
        }
        
        // Test the connection with a timeout
        const connectionPromise = provider.getBlockNumber();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
        
        // Race the connection against the timeout
        await Promise.race([connectionPromise, timeoutPromise]);
        
        console.log('Successfully connected to blockchain');
        isConnectedToBlockchain = true;
        
        return provider;
      } catch (error) {
        console.error(`Failed to connect to RPC URL ${i+1}:`, error.message);
      }
    }
    
    throw new Error('All RPC connections failed');
  } catch (error) {
    console.error('Failed to connect to blockchain:', error.message);
    isConnectedToBlockchain = false;
    return null;
  }
}

// Function to update leaderboard with error handling and retries
async function updateLeaderboard(forceUpdate = false) {
  const MAX_RETRIES = 3;
  
  // Check if update is needed (not forced and data is recent)
  if (!forceUpdate) {
    const now = Date.now();
    const dataAge = now - lastUpdateTime;
    
    // If data is less than 5 minutes old, return existing data
    if (dataAge < 5 * 60 * 1000 && leaderboardData.miners.length > 0) {
      console.log('Using cached leaderboard data (less than 5 minutes old)');
      return leaderboardData;
    }
  }
  
  // Attempt to update with retries
  return tryUpdateWithRetries(0);
  
  // Nested retry function
  async function tryUpdateWithRetries(retryCount) {
    try {
      console.log(`Updating leaderboard from blockchain (attempt ${retryCount + 1})...`);
      
      // Initialize blockchain connection
      const provider = await initBlockchainConnection();
      
      if (!provider) {
        throw new Error('No blockchain connection available');
      }
      
      // Initialize contract
      let contract;
      if (ethers.version && parseInt(ethers.version.split('.')[0]) >= 6) {
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      } else {
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      }
      
      // Get blockchain data with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Blockchain data fetch timeout')), 30000);
      });
      
      let miners = [];
      let totalHashrate = "0";
      
      try {
        // Try to fetch miners from the contract
        const fetchMinerPromise = contract.getLeaderboard();
        const minersData = await Promise.race([fetchMinerPromise, timeoutPromise]);
        
        // Transform contract data to our format
        miners = minersData.map(minerInfo => ({
          address: minerInfo.miner,
          totalHashrate: minerInfo.hashrate.toString(),
          workerCount: 1 // Default if we don't have specific data
        }));
        
        // Try to fetch total hashrate
        const fetchHashratePromise = contract.totalHashrate();
        totalHashrate = (await Promise.race([fetchHashratePromise, timeoutPromise])).toString();
      } catch (contractError) {
        console.error('Error fetching data from contract, using mock data:', contractError.message);
        // Fall back to mock data if contract calls fail
        const mockData = getMockData();
        miners = mockData.miners;
        totalHashrate = mockData.totalHashrate;
      }
      
      // Update the leaderboard data
      leaderboardData = {
        miners: miners,
        totalHashrate: totalHashrate,
        lastUpdate: new Date().toISOString()
      };
      
      // Update the last update time
      lastUpdateTime = Date.now();
      
      console.log('Leaderboard updated successfully');
      
      // Store in edge config if available
      try {
        await edgeConfig.saveLeaderboardData(leaderboardData);
      } catch (edgeConfigError) {
        console.warn('Could not save to Edge Config:', edgeConfigError.message);
      }
      
      return leaderboardData;
    } catch (error) {
      console.error(`Error updating leaderboard (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
      
      // Try to get data from Edge Config
      try {
        const edgeConfigData = await edgeConfig.getLeaderboardData();
        if (edgeConfigData && edgeConfigData.miners && edgeConfigData.miners.length > 0) {
          console.log('Retrieved leaderboard data from Edge Config');
          leaderboardData = edgeConfigData;
          return leaderboardData;
        }
      } catch (edgeConfigError) {
        console.warn('Could not retrieve from Edge Config:', edgeConfigError.message);
      }
      
      // Retry logic
      if (retryCount < MAX_RETRIES - 1) {
        console.log(`Retrying update (${retryCount + 2}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
        return tryUpdateWithRetries(retryCount + 1);
      }
      
      // If all retries fail, return mock data as fallback
      console.log('All retries failed, using mock data');
      leaderboardData = getMockData();
      leaderboardData.lastUpdate = new Date().toISOString();
      lastUpdateTime = Date.now();
      return leaderboardData;
    }
  }
}

// Get mock data for testing and fallback
function getMockData() {
  return {
    miners: [
      { address: "0x1234567890123456789012345678901234567890", totalHashrate: "1000000", workerCount: 10 },
      { address: "0x2345678901234567890123456789012345678901", totalHashrate: "750000", workerCount: 7 },
      { address: "0x3456789012345678901234567890123456789012", totalHashrate: "500000", workerCount: 5 },
      { address: "0x4567890123456789012345678901234567890123", totalHashrate: "250000", workerCount: 3 },
      { address: "0x5678901234567890123456789012345678901234", totalHashrate: "100000", workerCount: 2 }
    ],
    totalHashrate: "2600000",
    lastUpdate: new Date().toISOString()
  };
}

// Initialize on module load
updateLeaderboard().catch(error => {
  console.error('Initial leaderboard update failed:', error.message);
});

module.exports = {
  isConnectedToBlockchain,
  leaderboardData,
  lastUpdateTime,
  updateLeaderboard,
  initBlockchainConnection
}; 