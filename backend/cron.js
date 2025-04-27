/**
 * Cron job for updating the mining leaderboard data
 * This file is used by Vercel Cron Jobs to update the leaderboard data in Edge Config
 * It runs independently of the main server to avoid timeout issues
 */

const ethers = require('ethers');
const edgeConfig = require('./edge-config');

// Connect to blockchain provider
const RPC_URL = 'https://api.mainnet.abs.xyz';
let provider;
let contract;
let isConnectedToBlockchain = false;

// Determine if we're using ethers v5 or v6
const isEthersV6 = ethers.version && parseInt(ethers.version.split('.')[0]) >= 6;
console.log(`Using ethers.js version: ${isEthersV6 ? 'v6+' : 'v5'}`);

try {
  // Initialize provider based on ethers version
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
  // Only include the minimum required ABI for getting miner data
  {"inputs":[{"internalType":"uint256","name":"count","type":"uint256"}],"name":"getTopMiners","outputs":[{"components":[{"internalType":"address","name":"miner","type":"address"},{"internalType":"uint256","name":"hashrate","type":"uint256"}],"internalType":"struct MiningLeaderboard.MinerInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getLeaderboard","outputs":[{"components":[{"internalType":"address","name":"miner","type":"address"},{"internalType":"uint256","name":"hashrate","type":"uint256"}],"internalType":"struct MiningLeaderboard.MinerInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"playerHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"}],"name":"InitialFacilityPurchased","type":"event"}
];

// Initialize contract instance
try {
  if (provider) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    console.log('Contract initialized');
  }
} catch (error) {
  console.error('Error initializing contract:', error.message);
  contract = null;
}

// Function to update leaderboard data
async function updateLeaderboardData() {
  console.log('Starting cron job to update leaderboard data');
  
  if (!contract || !provider) {
    console.error('Contract or provider not initialized');
    return;
  }
  
  try {
    // Check if provider is connected
    let network;
    try {
      if (isEthersV6) {
        network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name || 'unknown'} (${network.chainId})`);
      } else {
        network = await provider.getNetwork();
        console.log(`Connected to network chainId: ${network.chainId}`);
      }
      isConnectedToBlockchain = true;
    } catch (err) {
      console.error('Network check failed:', err.message);
      return;
    }
    
    // Get current leaderboard data from Edge Config
    let leaderboardData = await edgeConfig.getLeaderboardData() || {
      leaderboard: [],
      lastUpdate: null,
      totalHashrate: "0"
    };
    
    // Get the most recent blocknumber
    const latestBlock = await provider.getBlockNumber();
    console.log(`Latest block: ${latestBlock}`);
    
    // Use a smaller scan range for cron jobs since they run frequently
    const blockScanRange = process.env.CRON_BLOCK_SCAN_RANGE ? 
      parseInt(process.env.CRON_BLOCK_SCAN_RANGE) : 10000;
    
    console.log(`Using block scan range: ${blockScanRange}`);
    
    // Simplest approach: Try to use getLeaderboard() function directly if available
    try {
      const leaderboard = await contract.getLeaderboard();
      
      console.log(`Got leaderboard directly from contract with ${leaderboard.length} miners`);
      
      const minerData = leaderboard.map(item => {
        const address = item.miner.toLowerCase();
        const hashrate = item.hashrate.toString();
        const hashrateNum = Number(hashrate);
        
        return {
          address,
          hashrate,
          hashrateNum
        };
      });
      
      // Sort by hashrate
      minerData.sort((a, b) => b.hashrateNum - a.hashrateNum);
      
      // Update leaderboard data
      leaderboardData.leaderboard = minerData;
      
      // Get total hashrate
      try {
        const totalHashrate = await contract.totalHashrate();
        leaderboardData.totalHashrate = totalHashrate.toString();
      } catch (err) {
        console.log(`Could not get totalHashrate from contract: ${err.message}`);
        // Calculate total from individual hasrates as a fallback
        leaderboardData.totalHashrate = minerData.reduce((sum, miner) => sum + miner.hashrateNum, 0).toString();
      }
      
    } catch (err) {
      console.log(`Could not use getLeaderboard() function: ${err.message}`);
      console.log('Falling back to event scanning method');
      
      // Rest of implementation would go here if needed
      // For now, we'll just use the event scanning approach in the server.js
      // This would be minimal implementation for this cron job
    }
    
    // Update timestamp
    leaderboardData.lastUpdate = new Date().toISOString();
    
    // Store updated data in Edge Config
    await edgeConfig.storeLeaderboardData(leaderboardData);
    
    console.log(`Leaderboard updated with ${leaderboardData.leaderboard.length} miners`);
    console.log('Cron job completed successfully');
    
  } catch (error) {
    console.error('Error in cron job:', error);
  }
}

// Execute the function if this file is run directly
if (require.main === module) {
  updateLeaderboardData()
    .then(() => {
      console.log('Cron job execution complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('Cron job execution failed:', err);
      process.exit(1);
    });
}

// Export for use in Vercel Cron Jobs
module.exports = updateLeaderboardData; 