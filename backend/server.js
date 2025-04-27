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
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet.abs.xyz';
const RPC_URL_ALTERNATE = process.env.RPC_URL_ALTERNATE || 'https://eth.llamarpc.com';

let provider;
let contract;
let isConnectedToBlockchain = false;

// Determine if we're using ethers v5 or v6
const isEthersV6 = ethers.version && parseInt(ethers.version.split('.')[0]) >= 6;
console.log(`Using ethers.js version: ${isEthersV6 ? 'v6+' : 'v5'}`);

try {
  // Initialize provider based on ethers version and environment
  const providerUrl = process.env.NODE_ENV === 'production' ? RPC_URL_ALTERNATE : RPC_URL;
  console.log(`Using RPC URL: ${providerUrl}`);
  
  if (isEthersV6) {
    provider = new ethers.JsonRpcProvider(providerUrl);
  } else {
    provider = new ethers.providers.JsonRpcProvider(providerUrl);
  }
  console.log('Provider initialized');
} catch (error) {
  console.error('Error initializing provider:', error.message);
  provider = null;
}

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

// Leaderboard data
let leaderboardData = {
  leaderboard: [],
  lastUpdate: null,
  totalHashrate: "0"
};

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
leaderboardData.leaderboard = [...mockLeaderboard];
leaderboardData.lastUpdate = new Date().toISOString();
console.log('Using mock data for initial load');

// Modified function to update leaderboard from blockchain
async function updateLeaderboard() {
  try {
    console.log('Updating leaderboard from blockchain...');
    
    // First check if we can get data from Edge Config
    const edgeConfigData = await edgeConfig.getLeaderboardData();
    if (edgeConfigData) {
      console.log('Got leaderboard data from Edge Config, using as baseline');
      leaderboardData = edgeConfigData;
      isConnectedToBlockchain = true; // Assume we're connected if we have Edge Config data
    }
    
    if (!contract || !provider) {
      throw new Error('Contract or provider not initialized');
    }
    
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
      throw new Error('Cannot connect to blockchain network');
    }
    
    // Get total hashrate from contract
    try {
      const totalHashrate = await contract.totalHashrate();
      console.log(`Total network hashrate from contract: ${totalHashrate.toString()}`);
      leaderboardData.totalHashrate = totalHashrate.toString();
    } catch (err) {
      console.log(`Could not get totalHashrate from contract: ${err.message}`);
      // Calculate total from individual hasrates as a fallback
      leaderboardData.totalHashrate = "0";
    }
    
    try {
      // New approach: Find miners by scanning events
      console.log('Scanning blockchain events to find miners...');
      
      // Get the most recent blocknumber
      const latestBlock = await provider.getBlockNumber();
      console.log(`Latest block: ${latestBlock}`);
      
      // Get block scan range from environment variable
      const blockScanRange = process.env.BLOCK_SCAN_RANGE ? 
        parseInt(process.env.BLOCK_SCAN_RANGE) : 
        (process.env.NODE_ENV === 'production' ? 100000 : 4000000);
      
      console.log(`Using block scan range: ${blockScanRange} (from ${process.env.BLOCK_SCAN_RANGE ? 'env variable' : 'default'})`);
      
      const fromBlock = Math.max(1, latestBlock - blockScanRange);
      
      console.log(`Full scanning block range: ${fromBlock} to ${latestBlock} (total: ${latestBlock - fromBlock} blocks)`);
      
      // Find miner addresses from events - focus on InitialFacilityPurchased events first
      const minerAddresses = new Set();
      
      // Function to handle paginated event scanning with timeouts
      async function scanEventsWithPagination(eventName, filter) {
        if (!contract.filters[eventName]) {
          console.log(`Filter for ${eventName} not available`);
          return;
        }
        
        try {
          console.log(`Searching for events using filter: ${eventName}`);
          
          // Use a smaller chunk size for serverless environment
          const CHUNK_SIZE = process.env.NODE_ENV === 'production' ? 50000 : 100000;
          console.log(`Using chunk size: ${CHUNK_SIZE} blocks`);
          
          let eventsCount = 0;
          
          // For serverless environment, only scan a few chunks to avoid timeout
          const MAX_CHUNKS = process.env.NODE_ENV === 'production' ? 2 : 100;
          let chunksProcessed = 0;
          
          // Scan the blockchain in chunks
          for (let chunkStart = fromBlock; chunkStart < latestBlock && chunksProcessed < MAX_CHUNKS; chunkStart += CHUNK_SIZE) {
            chunksProcessed++;
            const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, latestBlock);
            console.log(`Scanning ${eventName} events for block range: ${chunkStart} to ${chunkEnd} (chunk ${chunksProcessed}/${MAX_CHUNKS})`);
            
            try {
              // Add timeout to prevent hanging
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Query timeout after 15s')), 15000)
              );
              
              const eventsPromise = contract.queryFilter(filter, chunkStart, chunkEnd);
              
              // Race between the query and the timeout
              const events = await Promise.race([eventsPromise, timeoutPromise]);
              
              eventsCount += events.length;
              
              // Extract addresses from events
              events.forEach(event => {
                // Different events have player/miner at different arg positions
                const args = event.args || [];
                
                // Try to find all address-like arguments
                if (args.player) {
                  minerAddresses.add(args.player.toLowerCase());
                }
                // If we don't recognize the event but it has args
                else if (args.length > 0) {
                  // Try to find address-like arguments
                  args.forEach(arg => {
                    if (arg && typeof arg === 'string' && arg.startsWith('0x') && arg.length === 42) {
                      minerAddresses.add(arg.toLowerCase());
                    }
                  });
                }
              });
              
              console.log(`Found ${events.length} ${eventName} events in this chunk. Total: ${eventsCount}`);
              console.log(`Running total of unique addresses: ${minerAddresses.size}`);
              
            } catch (chunkErr) {
              // If a chunk fails, log the error and continue with the next chunk
              console.log(`Error scanning ${eventName} for block range ${chunkStart}-${chunkEnd}: ${chunkErr.message}`);
              
              // In serverless, if first chunk fails, don't continue with smaller chunks
              if (process.env.NODE_ENV === 'production') {
                console.log('Skipping further attempts in serverless environment');
                continue;
              }
              
              // If the error mentions "Query returned more than 10000 results", try a smaller chunk
              if (chunkErr.message.includes("more than 10000 results")) {
                const smallerChunkSize = Math.floor(CHUNK_SIZE / 4);
                console.log(`Reducing chunk size to ${smallerChunkSize} blocks and retrying...`);
                
                // Retry with smaller chunks but limit attempts
                const MAX_SMALL_CHUNKS = 2;
                let smallChunksProcessed = 0;
                
                for (let smallChunkStart = chunkStart; 
                     smallChunkStart < chunkEnd && smallChunksProcessed < MAX_SMALL_CHUNKS; 
                     smallChunkStart += smallerChunkSize) {
                  
                  smallChunksProcessed++;
                  const smallChunkEnd = Math.min(smallChunkStart + smallerChunkSize - 1, chunkEnd);
                  
                  try {
                    console.log(`Scanning with smaller chunk: ${smallChunkStart} to ${smallChunkEnd}`);
                    
                    // Add timeout for smaller chunk too
                    const smallTimeoutPromise = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('Query timeout after 10s')), 10000)
                    );
                    
                    const smallChunkEventsPromise = contract.queryFilter(filter, smallChunkStart, smallChunkEnd);
                    
                    const smallChunkEvents = await Promise.race([smallChunkEventsPromise, smallTimeoutPromise]);
                    
                    eventsCount += smallChunkEvents.length;
                    
                    // Extract addresses
                    smallChunkEvents.forEach(event => {
                      const args = event.args || [];
                      if (args.player) {
                        minerAddresses.add(args.player.toLowerCase());
                      } else if (args.length > 0) {
                        args.forEach(arg => {
                          if (arg && typeof arg === 'string' && arg.startsWith('0x') && arg.length === 42) {
                            minerAddresses.add(arg.toLowerCase());
                          }
                        });
                      }
                    });
                    
                    console.log(`Found ${smallChunkEvents.length} ${eventName} events in smaller chunk. Total: ${eventsCount}`);
                    
                  } catch (smallChunkErr) {
                    console.log(`Error in smaller chunk ${smallChunkStart}-${smallChunkEnd}: ${smallChunkErr.message}`);
                    // Continue with the next small chunk even if this one failed
                  }
                }
              }
            }
          }
          
          console.log(`Completed scanning for ${eventName}. Total events found: ${eventsCount} in ${chunksProcessed} chunks`);
          
        } catch (err) {
          console.log(`Error setting up scan for ${eventName}: ${err.message}`);
        }
      }
      
      try {
        // Only scan InitialFacilityPurchased event as it identifies all players who started the game
        if (contract.filters.InitialFacilityPurchased) {
          await scanEventsWithPagination('InitialFacilityPurchased', contract.filters.InitialFacilityPurchased());
          console.log(`Found ${minerAddresses.size} unique addresses from InitialFacilityPurchased events`);
        } else {
          console.log(`Filter for InitialFacilityPurchased not available`);
        }
        
        // Skip other event types since we only want to use InitialFacilityPurchased events
        console.log(`Using only InitialFacilityPurchased events`);
        
        if (minerAddresses.size === 0) {
          console.log('Could not find any miner addresses from InitialFacilityPurchased events');
          // Provide minimal mock data if nothing was found
          throw new Error('No miners found from events');
        }
        
        // Get hashrate for each miner
        const minerData = [];
        
        // Convert Set to Array for easier iteration
        const addresses = Array.from(minerAddresses);
        console.log(`Processing ${addresses.length} addresses...`);
        
        // Process addresses in smaller batches for serverless environment
        const BATCH_SIZE = process.env.NODE_ENV === 'production' ? 10 : 20;
        
        // Limit the number of addresses processed in serverless
        const MAX_ADDRESSES = process.env.NODE_ENV === 'production' ? 30 : addresses.length;
        const addressesToProcess = addresses.slice(0, MAX_ADDRESSES);
        
        if (process.env.NODE_ENV === 'production' && addresses.length > MAX_ADDRESSES) {
          console.log(`Processing only ${MAX_ADDRESSES} addresses out of ${addresses.length} to avoid timeout`);
        }
        
        for (let i = 0; i < addressesToProcess.length; i += BATCH_SIZE) {
          const batch = addressesToProcess.slice(i, i + BATCH_SIZE);
          
          // Add timeout protection for the whole batch
          const batchTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Batch processing timeout after 15s')), 15000)
          );
          
          // Process each address in the batch concurrently
          const batchProcessPromise = Promise.all(
            batch.map(async (address) => {
              try {
                // Add timeout for individual address processing
                const addressTimeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error(`Timeout processing address ${address}`)), 5000)
                );
                
                const processAddressPromise = (async () => {
                  // Try playerHashrate() function first
                  try {
                    const hashrate = await contract.playerHashrate(address);
                    const hashrateNum = Number(hashrate.toString());
                    
                    return {
                      address,
                      hashrate: hashrate.toString(),
                      hashrateNum
                    };
                  } catch (err) {
                    // If playerHashrate is not available, try miners mapping
                    try {
                      const hashrate = await contract.miners(address);
                      const hashrateNum = Number(hashrate.toString());
                      
                      return {
                        address,
                        hashrate: hashrate.toString(),
                        hashrateNum
                      };
                    } catch (minerErr) {
                      // If both fail, assign zero hashrate since we know they're players
                      return {
                        address,
                        hashrate: '0',
                        hashrateNum: 0
                      };
                    }
                  }
                })();
                
                // Race between processing and timeout
                return await Promise.race([processAddressPromise, addressTimeoutPromise]);
                
              } catch (err) {
                console.log(`Error getting data for ${address}:`, err.message);
                // Return a minimal object with zero hashrate for this address
                return {
                  address,
                  hashrate: '0',
                  hashrateNum: 0
                };
              }
            })
          );
          
          try {
            // Race between the whole batch and a timeout
            const batchResults = await Promise.race([batchProcessPromise, batchTimeoutPromise]);
            
            // Filter out null results and add to minerData
            minerData.push(...batchResults.filter(data => data !== null));
            
            console.log(`Processed batch ${i / BATCH_SIZE + 1}/${Math.ceil(addressesToProcess.length / BATCH_SIZE)}, found ${minerData.length} miners with data so far`);
          } catch (batchErr) {
            console.log(`Batch processing error: ${batchErr.message}`);
            // Continue with next batch
          }
        }
        
        if (minerData.length === 0) {
          throw new Error('No miners found with hashrate data');
        }
        
        // If we calculated individual hashrates but couldn't get totalHashrate directly,
        // calculate it from the sum of all miners
        if (leaderboardData.totalHashrate === "0" && minerData.length > 0) {
          const calculatedTotal = minerData.reduce((sum, miner) => sum + miner.hashrateNum, 0);
          leaderboardData.totalHashrate = calculatedTotal.toString();
          console.log(`Calculated total hashrate from miners: ${calculatedTotal} (fallback method)`);
        }
        
        // Update the leaderboard with the found miners
        leaderboardData.leaderboard = minerData;
        
      } catch (err) {
        console.error('Error scanning for miners:', err.message);
        throw err;
      }
      
    } catch (err) {
      console.error('Error processing blockchain data:', err.message);
      throw err;
    }
    
    // Sort by hashrate descending
    leaderboardData.leaderboard.sort((a, b) => b.hashrateNum - a.hashrateNum);
    
    // Update timestamp
    leaderboardData.lastUpdate = new Date().toISOString();
    
    // After successfully updating leaderboard data, store in Edge Config
    if (leaderboardData.leaderboard.length > 0) {
      await edgeConfig.storeLeaderboardData(leaderboardData);
    }
    
    console.log(`Leaderboard updated with ${leaderboardData.leaderboard.length} miners.`);
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    isConnectedToBlockchain = false;
    
    // Try to get data from Edge Config as fallback
    const edgeConfigData = await edgeConfig.getLeaderboardData();
    if (edgeConfigData) {
      console.log('Using Edge Config data as fallback');
      leaderboardData = edgeConfigData;
      // Mark as not connected but we still have data
      isConnectedToBlockchain = false;
    } else if (leaderboardData.leaderboard.length === 0) {
      // If we don't have any data yet from Edge Config, use mock data
      console.log('Using mock data as fallback');
      leaderboardData.leaderboard = [...mockLeaderboard];
      leaderboardData.lastUpdate = new Date().toISOString();
    }
  }
}

// Try to update the leaderboard, but don't block server start if it fails
updateLeaderboard().catch(err => {
  console.error('Initial leaderboard update failed:', err.message);
  console.log('Server will continue with mock data');
});

// Update leaderboard every 2 minutes
const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds
setInterval(() => {
  updateLeaderboard().catch(err => {
    console.error('Scheduled leaderboard update failed:', err.message);
  });
}, REFRESH_INTERVAL);

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

app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboardData);
});

// Health check endpoint - modified to include Edge Config status
app.get('/api/health', async (req, res) => {
  try {
    await edgeConfig.isEdgeConfigAvailable();
  } catch (error) {
    console.error('Error checking Edge Config availability:', error.message);
  }
  
  // Always get status, even if the availability check fails
  const edgeConfigStatus = edgeConfig.getEdgeConfigStatus();
  
  res.json({
    status: 'ok',
    blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
    edgeConfig: edgeConfigStatus,
    contract: CONTRACT_ADDRESS,
    miners: leaderboardData.leaderboard.length,
    lastUpdate: leaderboardData.lastUpdate,
    env: {
      EDGE_CONFIG_SET: process.env.EDGE_CONFIG ? 'yes' : 'no',
      NODE_ENV: process.env.NODE_ENV || 'not_set',
      BLOCK_SCAN_RANGE: process.env.BLOCK_SCAN_RANGE || 'not_set'
    }
  });
});

// Route for simulating hashrate updates (for testing)
app.post('/api/mock/update-hashrate', (req, res) => {
  const { address, hashrate } = req.body;
  
  if (!address || !hashrate) {
    return res.status(400).json({ success: false, message: 'Address and hashrate are required' });
  }
  
  // Find the miner in the leaderboard
  const existingMinerIndex = leaderboardData.leaderboard.findIndex(
    miner => miner.address.toLowerCase() === address.toLowerCase()
  );
  
  const hashrateNum = Number(hashrate);
  
  if (existingMinerIndex !== -1) {
    // Update existing miner
    leaderboardData.leaderboard[existingMinerIndex].hashrate = hashrate;
    leaderboardData.leaderboard[existingMinerIndex].hashrateNum = hashrateNum;
  } else {
    // Add new miner
    leaderboardData.leaderboard.push({
      address,
      hashrate,
      hashrateNum
    });
  }
  
  // Re-sort the leaderboard
  leaderboardData.leaderboard.sort((a, b) => b.hashrateNum - a.hashrateNum);
  
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