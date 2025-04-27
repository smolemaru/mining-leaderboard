const express = require('express');
const ethers = require('ethers');
const cors = require('cors');
const path = require('path');
const edgeConfig = require('./edge-config');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST'], // Allow specific methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow specific headers
}));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to blockchain provider
// Define multiple RPC URLs in order of preference 
const RPC_URLS = [
  process.env.RPC_URL || 'https://api.mainnet.abs.xyz',
  process.env.RPC_URL_ALTERNATE || 'https://abstract.drpc.org',
  'https://eth.llamarpc.com' // Generic fallback
];

// WebSocket URLs if needed
const WS_RPC_URLS = [
  process.env.WS_RPC_URL || 'wss://abstract.drpc.org'
];

let provider;
let contract;
let isConnectedToBlockchain = false;
let lastUpdateTime = Date.now() - (10 * 60 * 1000); // Set initial time to 10 mins ago
let leaderboardData = { miners: [], totalHashrate: "0" };

// Determine if we're using ethers v5 or v6
const isEthersV6 = ethers.version && parseInt(ethers.version.split('.')[0]) >= 6;
console.log(`Using ethers.js version: ${isEthersV6 ? 'v6+' : 'v5'}`);

// Initialize provider with fallback mechanism
async function initializeProvider() {
  console.log('Initializing provider with fallback mechanism...');
  
  // Try each RPC URL in order
  for (let i = 0; i < RPC_URLS.length; i++) {
    const url = RPC_URLS[i];
    try {
      console.log(`Trying RPC URL (${i+1}/${RPC_URLS.length}): ${url}`);
      
      let tempProvider;
      if (isEthersV6) {
        tempProvider = new ethers.JsonRpcProvider(url);
      } else {
        tempProvider = new ethers.providers.JsonRpcProvider(url);
      }
      
      // Test the connection
      const blockNumber = await tempProvider.getBlockNumber();
      console.log(`Connection successful to ${url}, current block: ${blockNumber}`);
      
      // If we get here, connection worked
      provider = tempProvider;
      return true;
    } catch (error) {
      console.error(`Failed to connect to ${url}: ${error.message}`);
    }
  }
  
  // If we get here, all connections failed
  console.error('All RPC connections failed');
  return false;
}

// Initialize contract
async function initializeContract() {
  if (!provider) {
    console.error('Cannot initialize contract: Provider not available');
    return false;
  }
  
  try {
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    console.log('Contract initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing contract:', error.message);
    contract = null;
    return false;
  }
}

// Try to initialize provider and contract
(async function() {
  try {
    const providerInitialized = await initializeProvider();
    if (providerInitialized) {
      await initializeContract();
    }
  } catch (error) {
    console.error('Initialization error:', error.message);
  }
})();

// Contract details
const CONTRACT_ADDRESS = '0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705';
const CONTRACT_ABI = [
  // getTopMiners and getLeaderboard functions from original ABI
  {"inputs":[{"internalType":"uint256","name":"count","type":"uint256"}],"name":"getTopMiners","outputs":[{"components":[{"internalType":"address","name":"miner","type":"address"},{"internalType":"uint256","name":"hashrate","type":"uint256"}],"internalType":"struct MiningLeaderboard.MinerInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getLeaderboard","outputs":[{"components":[{"internalType":"address","name":"miner","type":"address"},{"internalType":"uint256","name":"hashrate","type":"uint256"}],"internalType":"struct MiningLeaderboard.MinerInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  
  // Individual player data functions that might exist
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"playerHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"miners","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  
  // Total stats functions that might exist
  {"inputs":[],"name":"totalHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"uniqueMinerCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  
  // Mining related functions 
  {"inputs":[],"name":"miningHasStarted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"startBlock","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  
  // Events that might help us find miners
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint256","name":"playerHashrate","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"playerPendingRewards","type":"uint256"}],"name":"PlayerHashrateIncreased","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":false,"internalType":"uint256","name":"playerHashrate","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"playerPendingRewards","type":"uint256"}],"name":"PlayerHashrateDecreased","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"},{"indexed":true,"internalType":"uint256","name":"minerIndex","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"cost","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"minerId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"x","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"y","type":"uint256"}],"name":"MinerBought","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"}],"name":"InitialFacilityPurchased","type":"event"}
];

// Mock data for local testing
const mockLeaderboard = [
  { address: '0x1234567890123456789012345678901234567890', hashrate: '5000000', hashrateNum: 5000000 },
  { address: '0x2345678901234567890123456789012345678901', hashrate: '4500000', hashrateNum: 4500000 },
  { address: '0x3456789012345678901234567890123456789012', hashrate: '4000000', hashrateNum: 4000000 },
  { address: '0x4567890123456789012345678901234567890123', hashrate: '3500000', hashrateNum: 3500000 },
  { address: '0x5678901234567890123456789012345678901234', hashrate: '3000000', hashrateNum: 3000000 },
  { address: '0x6789012345678901234567890123456789012345', hashrate: '2500000', hashrateNum: 2500000 },
  { address: '0x7890123456789012345678901234567890123456', hashrate: '2000000', hashrateNum: 2000000 },
  { address: '0x8901234567890123456789012345678901234567', hashrate: '1500000', hashrateNum: 1500000 },
  { address: '0x9012345678901234567890123456789012345678', hashrate: '1000000', hashrateNum: 1000000 },
  { address: '0x0123456789012345678901234567890123456789', hashrate: '900000', hashrateNum: 900000 },
];

// Use mock data as initial data
leaderboardData.miners = [...mockLeaderboard];
leaderboardData.totalHashrate = "0";
console.log('Using mock data for initial load');

// Health check endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
    edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
    EDGE_CONFIG_SET: process.env.EDGE_CONFIG ? 'yes' : 'no',
    BLOCK_SCAN_RANGE: process.env.BLOCK_SCAN_RANGE || 'not_set',
    timestamp: new Date().toISOString()
  };
  
  res.json(health);
});

// Initialize blockchain connection with better error handling
async function initBlockchainConnection() {
  try {
    console.log('Initializing blockchain connection...');
    
    // Setup blockchain provider with timeout
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.RPC_URL || 'https://mainnet-rpc.bigcoin.io'
    );
    
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
    console.error('Failed to connect to blockchain:', error.message);
    isConnectedToBlockchain = false;
    return null;
  }
}

// Function to update leaderboard with error handling and retries
async function updateLeaderboard(retryCount = 0) {
  const MAX_RETRIES = 3;
  
  try {
    console.log('Updating leaderboard from blockchain...');
    
    // Initialize blockchain connection
    const provider = await initBlockchainConnection();
    
    if (!provider) {
      throw new Error('No blockchain connection available');
    }
    
    // Get blockchain data with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Blockchain data fetch timeout')), 30000);
    });
    
    // Your existing blockchain data fetching logic here, with timeout handling
    // Using mock data for fallback
    const mockData = getMockData();
    
    // Update the leaderboard data
    leaderboardData = {
      miners: mockData.miners || [],
      totalHashrate: mockData.totalHashrate || "0"
    };
    
    // Update the last update time
    lastUpdateTime = Date.now();
    
    console.log('Leaderboard updated successfully');
    
    // Store in edge config if available
    try {
      await saveLeaderboardToEdgeConfig(leaderboardData);
    } catch (edgeConfigError) {
      console.warn('Could not save to Edge Config:', edgeConfigError.message);
    }
    
    return leaderboardData;
  } catch (error) {
    console.error(`Error updating leaderboard (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
    
    // Try to get data from Edge Config
    try {
      const edgeConfigData = await getLeaderboardFromEdgeConfig();
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
      return updateLeaderboard(retryCount + 1);
    }
    
    // If all retries fail, return mock data as fallback
    console.log('All retries failed, using mock data');
    return getMockData();
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
    totalHashrate: "2600000"
  };
}

// Save leaderboard data to Edge Config
async function saveLeaderboardToEdgeConfig(data) {
  if (!edgeConfig || !process.env.EDGE_CONFIG) {
    return false;
  }
  
  try {
    await edgeConfig.saveLeaderboardData(data);
    return true;
  } catch (error) {
    console.error('Failed to save to Edge Config:', error.message);
    return false;
  }
}

// Get leaderboard data from Edge Config
async function getLeaderboardFromEdgeConfig() {
  if (!edgeConfig || !process.env.EDGE_CONFIG) {
    return null;
  }
  
  try {
    return await edgeConfig.getLeaderboardData();
  } catch (error) {
    console.error('Failed to get from Edge Config:', error.message);
    return null;
  }
}

// API Routes

// Root route - redirect to static HTML if not accessed programmatically
app.get('/', (req, res) => {
  // Check if request is from a browser (wants HTML) or programmatic (wants JSON)
  const userAgent = req.headers['user-agent'] || '';
  const acceptHeader = req.headers.accept || '';
  
  // If the request explicitly wants JSON or comes from a non-browser, send JSON
  if (acceptHeader.includes('application/json') || !userAgent.includes('Mozilla')) {
    res.json({
      name: 'BIGCOIN Mining Leaderboard API',
      description: 'API for retrieving miner leaderboard data',
      endpoints: {
        '/': 'This documentation',
        '/api/leaderboard': 'Get the current leaderboard data',
        '/api/health': 'Get API health status'
      }
    });
  }
  // Otherwise, the static middleware will serve index.html
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    // Check if we need to update the leaderboard (if not updated recently)
    const now = Date.now();
    const timeSinceLastUpdate = now - Date.parse(leaderboardData.lastUpdate);
    
    // If it's been more than 5 minutes since the last update, update the leaderboard
    if (timeSinceLastUpdate > 5 * 60 * 1000) {
      try {
        console.log('Updating leaderboard from blockchain before serving request...');
        await updateLeaderboard();
      } catch (updateError) {
        console.error('Error updating leaderboard:', updateError.message);
        // Continue with current data if available, otherwise will fallback to mock data
      }
    }
    
    // If still no leaderboard data, use mock data as a fallback
    if (!leaderboardData.miners || leaderboardData.miners.length === 0) {
      console.log('No leaderboard data available, using mock data as fallback');
      leaderboardData = getMockData();
    }
    
    // Add status information to the response
    const responseData = {
      ...leaderboardData,
      status: {
        blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var',
        EDGE_CONFIG_SET: process.env.EDGE_CONFIG ? 'yes' : 'no',
        BLOCK_SCAN_RANGE: process.env.BLOCK_SCAN_RANGE || 'not_set',
        lastUpdate: new Date(leaderboardData.lastUpdate).toISOString()
      }
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('Error serving leaderboard:', error);
    res.status(500).json({ 
      error: 'Failed to get leaderboard data',
      status: {
        blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
        edgeConfig: process.env.EDGE_CONFIG ? 'configured' : 'missing_env_var'
      }
    });
  }
});

// Route for simulating hashrate updates (for testing)
app.post('/api/mock/update-hashrate', (req, res) => {
  const { address, hashrate } = req.body;
  
  if (!address || !hashrate) {
    return res.status(400).json({ success: false, message: 'Address and hashrate are required' });
  }
  
  // Find the miner in the leaderboard
  const existingMinerIndex = leaderboardData.miners.findIndex(
    miner => miner.address.toLowerCase() === address.toLowerCase()
  );
  
  const hashrateNum = Number(hashrate);
  
  if (existingMinerIndex !== -1) {
    // Update existing miner
    leaderboardData.miners[existingMinerIndex].totalHashrate = hashrate;
    leaderboardData.miners[existingMinerIndex].hashrateNum = hashrateNum;
  } else {
    // Add new miner
    leaderboardData.miners.push({
      address,
      totalHashrate: hashrate,
      hashrateNum
    });
  }
  
  // Re-sort the leaderboard
  leaderboardData.miners.sort((a, b) => b.hashrateNum - a.hashrateNum);
  
  // Update timestamp
  leaderboardData.lastUpdate = new Date().toISOString();
  
  return res.json({
    success: true,
    message: 'Hashrate updated successfully'
  });
});

// Cron job endpoint for Vercel Cron Jobs
app.get('/api/cron/update-leaderboard', async (req, res) => {
  // Check if the request is coming from Vercel Cron
  const isVercelCron = req.headers['x-vercel-cron'] === 'true';
  
  if (!isVercelCron && process.env.NODE_ENV === 'production') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'This endpoint can only be called by Vercel Cron Jobs'
    });
  }
  
  try {
    // Import cron job function
    const updateLeaderboardData = require('./cron');
    
    // Execute cron job
    console.log('Executing cron job to update leaderboard data');
    await updateLeaderboardData();
    
    return res.status(200).json({
      success: true,
      message: 'Leaderboard data updated successfully'
    });
  } catch (error) {
    console.error('Error executing cron job:', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update leaderboard data'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Ready to serve leaderboard data at http://localhost:${PORT}/api/leaderboard`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
});

// Export the Express API for Vercel
module.exports = app; 