const express = require('express');
const ethers = require('ethers');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Setup blockchain connection
const RPC_URL = 'https://api.mainnet.abs.xyz';
let provider, contract, isConnectedToBlockchain = false;

// Determine ethers version
const isEthersV6 = ethers.version && parseInt(ethers.version.split('.')[0]) >= 6;
console.log(`Using ethers.js version: ${isEthersV6 ? 'v6+' : 'v5'}`);

// Initialize provider
try {
  if (isEthersV6) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  } else {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  }
  console.log('Provider initialized');
} catch (error) {
  console.error('Error initializing provider:', error.message);
  provider = null;
}

// Contract details
const CONTRACT_ADDRESS = '0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705';
const CONTRACT_ABI = [
  // Just the essential functions we need
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"playerHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"miners","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"}],"name":"InitialFacilityPurchased","type":"event"}
];

// Initialize contract
try {
  if (provider) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    console.log('Contract initialized');
  }
} catch (error) {
  console.error('Error initializing contract:', error.message);
  contract = null;
}

// Mock data for when blockchain is unavailable
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

// Leaderboard data
let leaderboardData = {
  leaderboard: [...mockLeaderboard], // Start with mock data
  lastUpdate: new Date().toISOString()
};

// Simple check of blockchain connection
async function checkBlockchainConnection() {
  if (!provider) return false;
  
  try {
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name || 'unknown'} (${isEthersV6 ? network.chainId : network.chainId.toString()})`);
    isConnectedToBlockchain = true;
    return true;
  } catch (error) {
    console.error('Failed to connect to blockchain:', error.message);
    isConnectedToBlockchain = false;
    return false;
  }
}

// Simple leaderboard update function
async function updateLeaderboard() {
  try {
    console.log('Attempting to update leaderboard from blockchain...');
    
    // First check if we can connect
    const connected = await checkBlockchainConnection();
    if (!connected) {
      throw new Error('Not connected to blockchain');
    }
    
    // Find miners through events - simplified approach
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(1, latestBlock - 5000); // Look back 5000 blocks
    
    console.log(`Scanning blocks ${fromBlock} to ${latestBlock} for miners...`);
    
    // Use InitialFacilityPurchased events to find players
    const filter = contract.filters.InitialFacilityPurchased();
    const events = await contract.queryFilter(filter, fromBlock, latestBlock);
    
    console.log(`Found ${events.length} InitialFacilityPurchased events`);
    
    if (events.length === 0) {
      throw new Error('No events found');
    }
    
    // Extract unique addresses
    const addresses = new Set();
    events.forEach(event => {
      if (event.args && event.args.player) {
        addresses.add(event.args.player.toLowerCase());
      }
    });
    
    console.log(`Found ${addresses.size} unique addresses`);
    
    // Get hashrate for each address
    const minerData = [];
    for (const address of addresses) {
      try {
        // Try playerHashrate first
        let hashrate;
        try {
          hashrate = await contract.playerHashrate(address);
        } catch (err) {
          // If that fails, try miners mapping
          hashrate = await contract.miners(address);
        }
        
        const hashrateNum = Number(hashrate.toString());
        
        // Only include non-zero hashrates
        if (hashrateNum > 0) {
          minerData.push({
            address,
            hashrate: hashrate.toString(),
            hashrateNum
          });
        }
      } catch (error) {
        console.log(`Couldn't get hashrate for ${address}: ${error.message}`);
      }
    }
    
    console.log(`Found ${minerData.length} miners with non-zero hashrate`);
    
    if (minerData.length === 0) {
      throw new Error('No miners found with hashrate');
    }
    
    // Sort by hashrate (descending)
    minerData.sort((a, b) => b.hashrateNum - a.hashrateNum);
    
    // Update the leaderboard
    leaderboardData.leaderboard = minerData;
    leaderboardData.lastUpdate = new Date().toISOString();
    
    console.log('Leaderboard updated successfully');
  } catch (error) {
    console.error('Error updating leaderboard:', error.message);
    
    // If we don't already have data, use mock data
    if (leaderboardData.leaderboard.length === 0) {
      leaderboardData.leaderboard = [...mockLeaderboard];
      leaderboardData.lastUpdate = new Date().toISOString();
    }
  }
}

// API Routes
app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboardData);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
    contract: CONTRACT_ADDRESS,
    miners: leaderboardData.leaderboard.length,
    lastUpdate: leaderboardData.lastUpdate
  });
});

// Mock update endpoint for testing
app.post('/api/mock/update-hashrate', (req, res) => {
  const { address, hashrate } = req.body;
  
  if (!address || !hashrate) {
    return res.status(400).json({ success: false, message: 'Address and hashrate are required' });
  }
  
  const hashrateNum = Number(hashrate);
  
  // Update existing miner or add new one
  const existingIndex = leaderboardData.leaderboard.findIndex(
    miner => miner.address.toLowerCase() === address.toLowerCase()
  );
  
  if (existingIndex !== -1) {
    leaderboardData.leaderboard[existingIndex].hashrate = hashrate;
    leaderboardData.leaderboard[existingIndex].hashrateNum = hashrateNum;
  } else {
    leaderboardData.leaderboard.push({
      address,
      hashrate,
      hashrateNum
    });
  }
  
  // Sort the leaderboard
  leaderboardData.leaderboard.sort((a, b) => b.hashrateNum - a.hashrateNum);
  
  // Update timestamp
  leaderboardData.lastUpdate = new Date().toISOString();
  
  return res.json({
    success: true,
    message: 'Hashrate updated successfully'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/leaderboard`);
  console.log(`Health check at http://localhost:${PORT}/api/health`);
  
  // Try to update leaderboard initially, but don't block server start
  updateLeaderboard().catch(err => {
    console.log('Initial update failed, using mock data:', err.message);
  });
  
  // Update every 2 minutes
  setInterval(() => {
    updateLeaderboard().catch(err => {
      console.log('Scheduled update failed:', err.message);
    });
  }, 2 * 60 * 1000);
}); 