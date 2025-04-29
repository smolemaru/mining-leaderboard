/**
 * Blockchain service for Mining Leaderboard
 * 
 * This module handles all interactions with the blockchain
 * and provides data to the API routes.
 */

const ethers = require('ethers');
const edgeConfig = require('../edge-config');
const fs = require('fs');
const path = require('path');

// Variables to track connection and data status
let isConnectedToBlockchain = false;
let lastUpdateTime = Date.now() - (60 * 60 * 1000); // Set initial time to 1 hour ago
let leaderboardData = { miners: [], totalHashrate: "0" };
let minerData = {};
let provider = null; // Global provider variable
let lastUpdateAttemptTime = 0;
const UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour (sync with cache age)
const MIN_UPDATE_ATTEMPT_INTERVAL = 60 * 60 * 1000; // Minimum 1 hour between update attempts

// Connection health tracking
let connectionHealthCounter = 0;
const CONNECTION_HEALTH_THRESHOLD = 2; // Min health required to consider connection stable
let currentRpcIndex = 0; // Track which RPC endpoint we're using

// Batch processing configuration
let BATCH_SIZE = 20; // Start with a moderate batch size
let BATCH_DELAY_MS = 1000; // Delay between batches (1 second)
const MAX_BATCH_SIZE = 50; // Maximum batch size to limit concurrency
const MIN_BATCH_SIZE = 5; // Minimum batch size to avoid excessive delays

// Add file cache for miners to improve performance
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const MINERS_CACHE_PATH = path.join(CACHE_DIR, 'miners-cache.json');

// Add cache configuration
const CACHE_CONFIG = {
  MINERS_MAX_AGE_MS: 60 * 60 * 1000, // 1 hour maximum cache age
  LEADERBOARD_MAX_AGE_MS: 60 * 60 * 1000 // 1 hour maximum leaderboard cache age (changed from 5 minutes)
};

// Add leaderboard cache file path
const LEADERBOARD_CACHE_PATH = path.join(CACHE_DIR, 'leaderboard-cache.json');

// Add update state tracking
let isUpdating = false;
let lastFullUpdate = 0;

// Add genesis block tracking
const GENESIS_BLOCK = 5606285;
let lastScannedBlock = GENESIS_BLOCK;

// Ensure cache directory exists
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('Created cache directory');
  }
} catch (err) {
  console.error('Failed to create cache directory:', err.message);
}

// Helper function to save leaderboard data to cache
function saveLeaderboardToCache(data) {
  try {
    console.log('Saving data to cache:', {
      hasMiners: !!data?.miners,
      minersLength: data?.miners?.length || 0,
      totalHashrate: data?.totalHashrate || '0'
    });

    // Ensure we're saving in the correct format
    const cacheData = {
      timestamp: Date.now(),
      data: {
        miners: data.miners || [],
        totalHashrate: data.totalHashrate || "0",
        lastUpdated: new Date().toISOString()
      }
    };

    fs.writeFileSync(
      LEADERBOARD_CACHE_PATH,
      JSON.stringify(cacheData)
    );
    console.log('Saved leaderboard data to cache with', cacheData.data.miners.length, 'miners');
  } catch (err) {
    console.error('Failed to save leaderboard data to cache:', err.message);
  }
}

// Helper function to load leaderboard data from cache
function loadLeaderboardFromCache() {
  try {
    if (fs.existsSync(LEADERBOARD_CACHE_PATH)) {
      console.log('Found leaderboard cache file');
      const cacheData = JSON.parse(fs.readFileSync(LEADERBOARD_CACHE_PATH, 'utf8'));
      console.log('Parsed cache data:', {
        hasTimestamp: !!cacheData.timestamp,
        hasData: !!cacheData.data,
        hasMiners: !!cacheData.data?.miners,
        minersLength: cacheData.data?.miners?.length || 0
      });
      
      const cacheAge = Date.now() - cacheData.timestamp;
      
      if (cacheAge <= CACHE_CONFIG.LEADERBOARD_MAX_AGE_MS) {
        console.log(`Loaded leaderboard from cache (${Math.floor(cacheAge / 60000)} minutes old)`);
        
        // Ensure the data has the correct structure
        const validData = {
          miners: cacheData.data?.miners || [],
          totalHashrate: cacheData.data?.totalHashrate || "0",
          lastUpdated: new Date(cacheData.timestamp).toISOString(),
          status: {
            blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
            lastUpdate: new Date(cacheData.timestamp).toISOString()
          }
        };
        
        console.log('Validated cache data:', {
          hasMiners: !!validData.miners,
          minersLength: validData.miners.length,
          totalHashrate: validData.totalHashrate
        });
        
        return validData;
      } else {
        console.log(`Leaderboard cache too old (${Math.floor(cacheAge / 60000)} minutes), will refresh`);
      }
    } else {
      console.log('No leaderboard cache file found');
    }
  } catch (err) {
    console.error('Failed to load leaderboard from cache:', err.message);
  }
  return null;
}

// Helper function to save miner addresses to cache
function saveMinerAddressesToCache(minerAddresses) {
  try {
    // Convert Set to Array before saving
    const addressesArray = Array.from(minerAddresses);
    fs.writeFileSync(
      MINERS_CACHE_PATH,
      JSON.stringify({
        timestamp: Date.now(),
        addresses: addressesArray,
        lastScannedBlock: lastScannedBlock
      })
    );
    console.log(`Saved ${addressesArray.length} miner addresses to cache (last block: ${lastScannedBlock})`);
  } catch (err) {
    console.error('Failed to save miner addresses to cache:', err.message);
  }
}

// Helper function to load miner addresses from cache
function loadMinerAddressesFromCache() {
  try {
    if (fs.existsSync(MINERS_CACHE_PATH)) {
      const cacheData = JSON.parse(fs.readFileSync(MINERS_CACHE_PATH, 'utf8'));
      const cacheAge = Date.now() - cacheData.timestamp;
      
      // Check if cache is too old
      if (cacheAge > CACHE_CONFIG.MINERS_MAX_AGE_MS) {
        console.log(`Miners cache too old (${Math.floor(cacheAge / 60000)} minutes), but will keep historical miners`);
      }
      
      const addressesSet = new Set(cacheData.addresses);
      console.log(`Loaded ${addressesSet.size} miner addresses from cache (${Math.floor(cacheAge / 60000)} minutes old)`);
      
      // Also restore last scanned block
      if (cacheData.lastScannedBlock) {
        lastScannedBlock = cacheData.lastScannedBlock;
        console.log(`Restored last scanned block: ${lastScannedBlock}`);
      }
      
      return addressesSet;
    }
  } catch (err) {
    console.error('Failed to load miner addresses from cache:', err.message);
  }
  return new Set();
}

// Contract details
const CONTRACT_ADDRESS = '0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705';
const CONTRACT_ABI = [
  // We are only using these functions:
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"playerHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  // Event for finding miners
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"player","type":"address"}],"name":"InitialFacilityPurchased","type":"event"}
];

// RPC URLs for blockchain connection
const RPC_URLS = [
  'https://api.mainnet.abs.xyz', // Official Abstract L2 RPC endpoint
  'https://rpc.ankr.com/abstract', // Ankr's Abstract endpoint
  'https://public-abs-rpc.haqq.network', // HAQQ's Abstract endpoint
  process.env.RPC_URL, // Custom RPC URL if provided
  process.env.RPC_URL_ALTERNATE // Alternative RPC URL if provided
].filter(url => url); // Remove any null/undefined entries

// Connection stability improvements:
// 1. The connection monitor will check connectivity every 30 seconds and reconnect if needed
// 2. If one RPC endpoint fails, the system will automatically try the next available endpoint
// 3. We prioritize official and reliable Abstract L2 RPC endpoints

// Function to explicitly update blockchain connection status
function setBlockchainConnected(status) {
  const prevStatus = isConnectedToBlockchain;
  isConnectedToBlockchain = !!status;
  
  // Only log if status changed or it's a forced update
  if (prevStatus !== isConnectedToBlockchain || status === true) {
    console.log(`Blockchain connection status set to: ${isConnectedToBlockchain ? 'connected' : 'disconnected'}`);
  }
  
  // If we've just disconnected, reset the connection health counter
  if (!isConnectedToBlockchain) {
    connectionHealthCounter = 0;
  }
}

// Initialize blockchain connection with error handling
async function initBlockchainConnection() {
  try {
    console.log('Initializing blockchain connection...');
    console.log(`Trying ${RPC_URLS.length} available RPC endpoints`);
    
    // Try each RPC URL until one works, starting from the current index
    const startIndex = currentRpcIndex;
    let attempts = 0;
    
    while (attempts < RPC_URLS.length) {
      const i = (startIndex + attempts) % RPC_URLS.length;
      currentRpcIndex = i;
      
      try {
        const url = RPC_URLS[i];
        console.log(`Trying RPC URL (${i+1}/${RPC_URLS.length}): ${url}`);
        
        // Determine ethers version and create provider accordingly
        let newProvider;
        if (ethers.version && parseInt(ethers.version.split('.')[0]) >= 6) {
          newProvider = new ethers.JsonRpcProvider(url);
        } else {
          newProvider = new ethers.providers.JsonRpcProvider(url);
        }
        
        // Test the connection with a timeout
        const connectionPromise = newProvider.getBlockNumber();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
        
        // Race the connection against the timeout
        const blockNumber = await Promise.race([connectionPromise, timeoutPromise]);
        
        console.log(`Successfully connected to blockchain at block ${blockNumber} using ${url}`);
        provider = newProvider; // Store provider in global variable
        setBlockchainConnected(true);
        connectionHealthCounter = 3; // Start with a higher health value for stability
        
        // Monitor connection status periodically
        startConnectionMonitoring();
        
        return provider;
      } catch (error) {
        console.error(`Failed to connect to RPC URL ${i+1} (${RPC_URLS[i]}):`, error.message);
        attempts++;
      }
    }
    
    throw new Error('All RPC connections failed');
  } catch (error) {
    console.error('Failed to connect to blockchain:', error.message);
    setBlockchainConnected(false);
    provider = null;
    connectionHealthCounter = 0;
    return null;
  }
}

// Monitor connection periodically to detect disconnections
function startConnectionMonitoring() {
  // Clear any existing interval
  if (global.connectionMonitorInterval) {
    clearInterval(global.connectionMonitorInterval);
  }
  
  // Check connection every 15 seconds (reduced from 30)
  global.connectionMonitorInterval = setInterval(async () => {
    if (!provider) {
      console.log('No provider available, attempting to reconnect...');
      setBlockchainConnected(false);
      connectionHealthCounter = 0;
      await initBlockchainConnection();
      return;
    }
    
    try {
      // Simple check to see if we're still connected
      const blockNumber = await provider.getBlockNumber();
      
      // Increase health counter (max 5)
      connectionHealthCounter = Math.min(connectionHealthCounter + 1, 5);
      
      // Only set as connected if we have consistent connectivity
      if (connectionHealthCounter >= CONNECTION_HEALTH_THRESHOLD && !isConnectedToBlockchain) {
        console.log(`Connection restored and stable (health: ${connectionHealthCounter}/5) at block ${blockNumber}`);
        setBlockchainConnected(true);
      }
    } catch (error) {
      console.error('Connection check failed:', error.message);
      
      // Decrease health counter
      connectionHealthCounter = Math.max(connectionHealthCounter - 1, 0);
      
      // If health counter is too low, consider disconnected
      if (connectionHealthCounter < CONNECTION_HEALTH_THRESHOLD) {
        if (isConnectedToBlockchain) {
          console.log(`Connection unstable (health: ${connectionHealthCounter}/5), attempting to reconnect...`);
          setBlockchainConnected(false);
        }
        
        // Force attempt to next RPC endpoint
        currentRpcIndex = (currentRpcIndex + 1) % RPC_URLS.length;
        await initBlockchainConnection();
      }
    }
  }, 15000); // 15 seconds - reduced from 30
  
  console.log('Connection monitoring started with 15-second interval');
}

// Function to update miners list from blockchain events
async function updateMinersFromEvents(contract, provider) {
  console.log('Updating miners list from blockchain events...');
  const minerAddresses = new Set();
  
  try {
    // Get the latest block number
    const latestBlock = await provider.getBlockNumber();
    console.log(`Current block number: ${latestBlock}`);
    
    // Load existing miners from cache first
    const cachedAddresses = loadMinerAddressesFromCache();
    if (cachedAddresses.size > 0) {
      console.log(`Loaded ${cachedAddresses.size} miners from cache`);
      cachedAddresses.forEach(address => minerAddresses.add(address));
      
      // Get last scanned block from cache
      const cacheData = JSON.parse(fs.readFileSync(MINERS_CACHE_PATH, 'utf8'));
      if (cacheData.lastScannedBlock) {
        lastScannedBlock = cacheData.lastScannedBlock;
        console.log(`Resuming scan from block ${lastScannedBlock}`);
      }
    } else {
      console.log(`Starting fresh scan from genesis block ${GENESIS_BLOCK}`);
      lastScannedBlock = GENESIS_BLOCK;
    }
    
    // Calculate optimal chunk size based on block range
    // Use smaller chunks to avoid RPC limits
    const BLOCKS_PER_DAY = 7200; // ~7200 blocks per day on Abstract
    const CHUNK_SIZE = BLOCKS_PER_DAY * 7; // 1 week of blocks
    const MAX_RETRIES = 3;
    
    console.log(`Scanning from block ${lastScannedBlock} to ${latestBlock}`);
    
    let currentBlock = lastScannedBlock;
    while (currentBlock < latestBlock) {
      let endBlock = Math.min(currentBlock + CHUNK_SIZE, latestBlock);
      let retryCount = 0;
      let success = false;
      
      while (!success && retryCount < MAX_RETRIES) {
        try {
          console.log(`Scanning blocks ${currentBlock} to ${endBlock}...`);
          const filter = contract.filters.InitialFacilityPurchased();
          const events = await contract.queryFilter(filter, currentBlock, endBlock);
          
          if (events.length > 0) {
            console.log(`Found ${events.length} miner events in blocks ${currentBlock}-${endBlock}`);
            events.forEach(event => {
              minerAddresses.add(event.args.player);
            });
          }
          
          success = true;
        } catch (error) {
          if (error.message && error.message.includes('Query returned more than 10000 results')) {
            // If we hit the 10k limit, reduce chunk size and retry
            const newChunkSize = Math.floor((endBlock - currentBlock) / 2);
            endBlock = currentBlock + newChunkSize;
            console.log(`Reducing chunk size to ${newChunkSize} blocks due to RPC limit`);
            retryCount++;
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
      
      if (!success) {
        console.error(`Failed to scan blocks after ${MAX_RETRIES} retries`);
        break;
      }
      
      // Update progress
      lastScannedBlock = endBlock;
      currentBlock = endBlock + 1;
      
      // Save progress periodically
      if (minerAddresses.size > 0 && minerAddresses.size % 1000 === 0) {
        saveMinerAddressesToCache(minerAddresses);
        console.log(`Progress saved: ${minerAddresses.size} miners found, last block: ${lastScannedBlock}`);
      }
      
      // Add small delay between chunks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final save with all miners
    if (minerAddresses.size > 0) {
      saveMinerAddressesToCache(minerAddresses);
      console.log(`Scan completed: ${minerAddresses.size} total miners, last block: ${lastScannedBlock}`);
    }
    
    return minerAddresses;
  } catch (error) {
    console.error('Error updating miners from events:', error.message);
    // If error occurs, return existing miners from cache
    const cachedAddresses = loadMinerAddressesFromCache();
    console.log(`Falling back to ${cachedAddresses.size} cached miners`);
    return cachedAddresses;
  }
}

// Memory monitoring function
function checkMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memoryUsage = process.memoryUsage();
    const mbUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const mbTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    console.log(`Memory usage: ${mbUsed}MB / ${mbTotal}MB (${Math.round(mbUsed/mbTotal*100)}%)`);
    
    // If memory usage is too high (>85%), reduce batch size
    if (mbUsed / mbTotal > 0.85 && BATCH_SIZE > MIN_BATCH_SIZE) {
      const newBatchSize = Math.max(MIN_BATCH_SIZE, Math.floor(BATCH_SIZE * 0.7));
      console.log(`High memory usage detected! Reducing batch size from ${BATCH_SIZE} to ${newBatchSize}`);
      BATCH_SIZE = newBatchSize;
    }
    
    return mbUsed / mbTotal; // Return memory usage ratio
  }
  return 0;
}

// Modified updateLeaderboard function to handle background updates properly
async function updateLeaderboard(forceUpdate = false) {
  if (!isConnectedToBlockchain) {
    console.log('Cannot update leaderboard: Not connected to blockchain');
    return { success: false, error: 'Not connected to blockchain' };
  }

  const now = Date.now();
  const timeSinceLastAttempt = now - lastUpdateAttemptTime;

  // Check if we're trying to update too frequently
  if (!forceUpdate && timeSinceLastAttempt < MIN_UPDATE_ATTEMPT_INTERVAL) {
    console.log(`Update attempted too soon. Next update available in ${Math.floor((MIN_UPDATE_ATTEMPT_INTERVAL - timeSinceLastAttempt) / 1000)} seconds`);
    return { success: true, data: leaderboardData };
  }

  // First phase: Always try to load cached data first
  const cachedData = loadLeaderboardFromCache();
  if (cachedData) {
    console.log('Loading cached leaderboard data');
    leaderboardData = cachedData;
    
    // If we're already updating or updated recently, just return cached data
    if (isUpdating) {
      console.log('Update already in progress, using cached data');
      return { success: true, data: leaderboardData };
    }
    
    // Check if we need to start a background update
    const timeSinceLastUpdate = now - lastFullUpdate;
    if (!forceUpdate && timeSinceLastUpdate < UPDATE_INTERVAL_MS) {
      console.log(`Using cached data, next update in ${Math.floor((UPDATE_INTERVAL_MS - timeSinceLastUpdate) / 1000)} seconds`);
      return { success: true, data: leaderboardData };
    }
  }

  // Update lastUpdateAttemptTime before starting the update
  lastUpdateAttemptTime = now;

  // Don't start another update if one is in progress
  if (isUpdating) {
    console.log('Update already in progress');
    return { success: true, data: leaderboardData };
  }

  // Start background update
  isUpdating = true;
  console.log('Starting background leaderboard update...');

  try {
    if (!provider) {
      throw new Error('No blockchain provider available');
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // Test connection
    await safeContractCall(
      async () => await provider.getBlockNumber(),
      null,
      'Connection check failed'
    );

    // Get network total hashrate
    const networkTotalHashrate = await safeContractCall(
      async () => await contract.totalHashrate(),
      null,
      'Error fetching total network hashrate'
    );

    if (!networkTotalHashrate) {
      throw new Error('Failed to get network total hashrate');
    }

    // Update miners list from events
    const minerAddresses = await updateMinersFromEvents(contract, provider);
    
    // Get all miners from the contract
    console.log('Retrieving miners from blockchain events...');
    
    // Convert Set to Array for processing
    const minerArray = Array.from(minerAddresses);
    
    // Process all miners
    const MAX_MINERS_TO_PROCESS = minerArray.length;
    
    // Log the total count for verification
    console.log(`Processing all ${MAX_MINERS_TO_PROCESS} miners`);

    // Reset miner data
    minerData = {};

    // Optimize batch size for large datasets
    if (MAX_MINERS_TO_PROCESS > 1000) {
      const oldBatchSize = BATCH_SIZE;
      BATCH_SIZE = Math.min(MAX_BATCH_SIZE, Math.max(BATCH_SIZE, Math.floor(MAX_MINERS_TO_PROCESS / 1000)));
      console.log(`Optimizing for large dataset: Increasing batch size from ${oldBatchSize} to ${BATCH_SIZE}`);
    }

    // Split miners into batches
    const batches = [];
    for (let i = 0; i < MAX_MINERS_TO_PROCESS; i += BATCH_SIZE) {
      batches.push(minerArray.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Processing miners in ${batches.length} batches of up to ${BATCH_SIZE} miners each`);

    // Performance tracking
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalResponseTime = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    const UPDATE_PROGRESS_INTERVAL = 10;
    
    let totalHashrate = BigInt(0);
    
    const startTime = Date.now();
    let lastProgressTime = startTime;
    let lastMemoryCheck = startTime;
    
    // Process batches
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Check memory usage every 1 minute
      const now = Date.now();
      if (now - lastMemoryCheck > 60000) {
        checkMemoryUsage();
        lastMemoryCheck = now;
      }
      
      // Log progress periodically for large datasets
      if (batchIndex % UPDATE_PROGRESS_INTERVAL === 0 || batchIndex === batches.length - 1) {
        const currentTime = Date.now();
        const elapsedSecs = (currentTime - startTime) / 1000;
        const progress = ((batchIndex + 1) / batches.length * 100).toFixed(1);
        const minersDone = (batchIndex + 1) * BATCH_SIZE;
        const estimatedTotalTime = elapsedSecs / (batchIndex + 1) * batches.length;
        const remainingTime = Math.max(0, estimatedTotalTime - elapsedSecs);
        
        console.log(`Progress: ${progress}% (${minersDone}/${MAX_MINERS_TO_PROCESS} miners) | ` + 
                    `Elapsed: ${elapsedSecs.toFixed(1)}s | Est. remaining: ${remainingTime.toFixed(1)}s`);
        
        // Save progress to leaderboard data periodically in case of interruption
        if (currentTime - lastProgressTime > 30000 && Object.keys(minerData).length > 0) {
          // Create a temporary leaderboard with current progress
          const tempMinerEntries = Object.entries(minerData);
          const tempMiners = tempMinerEntries.map(([address, data]) => ({
            address,
            hashrate: data.hashrate.toString(),
            totalHashrate: data.hashrate.toString()
          }));
          
          // Sort and update leaderboard data
          const tempSortedMiners = tempMiners.sort((a, b) => {
            const hashrateA = BigInt(a.hashrate || "0");
            const hashrateB = BigInt(b.hashrate || "0");
            return hashrateB > hashrateA ? 1 : hashrateB < hashrateA ? -1 : 0;
          });
          
          // Calculate current total hashrate
          const tempTotalHashrate = totalHashrate.toString();
          
          // Update leaderboard data with progress
          leaderboardData = {
            miners: tempSortedMiners,
            networkHashrate: tempTotalHashrate,
            totalHashrate: tempTotalHashrate,
            totalMiners: tempMiners.length,
            lastUpdated: new Date().toISOString(),
            isPartialUpdate: true // Flag to indicate this is a partial update
          };
          
          // Save progress to cache
          saveLeaderboardToCache(leaderboardData);
          
          lastUpdateTime = Date.now();
          lastProgressTime = currentTime;
          console.log(`Saved progress with ${tempSortedMiners.length} miners processed so far`);
        }
      }
      
      // Check if we lost connection during processing
      if (!isConnectedToBlockchain) {
        console.log('Connection lost during batch processing, aborting leaderboard update');
        throw new Error('Connection lost during batch processing');
      }
      
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} miners`);
      
      const batchPromises = [];
      const batchStartTime = Date.now();
      
      for (const address of batch) {
        totalRequests++;
        batchPromises.push(
          fetchHashrateWithRetries(contract, address).then(hashrate => {
            // Record successful request
            successfulRequests++;
            consecutiveErrors = 0;
            
            // Store hashrate in minerData
            if (!minerData[address]) {
              minerData[address] = { hashrate: BigInt(hashrate) };
            } else {
              minerData[address].hashrate = BigInt(hashrate);
            }
            
            // Add to total hashrate
            totalHashrate += BigInt(hashrate);
          }).catch(error => {
            console.error(`Error processing miner ${address}:`, error.message);
            consecutiveErrors++;
            
            // If too many errors in a row, connection might be unstable
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.error(`${MAX_CONSECUTIVE_ERRORS} consecutive errors detected, connection may be unstable`);
              // Force a connection health check
              connectionHealthCounter = Math.max(connectionHealthCounter - 2, 0);
              
              // Reset consecutive errors counter
              consecutiveErrors = 0;
            }
          })
        );
      }
      
      // Wait for all promises in this batch to resolve
      await Promise.all(batchPromises);
      
      // If connection health is too low, stop processing
      if (connectionHealthCounter < CONNECTION_HEALTH_THRESHOLD) {
        console.log('Connection health too low, aborting leaderboard update');
        throw new Error('Connection health degraded during batch processing');
      }
      
      // Calculate batch response time
      const batchResponseTime = Date.now() - batchStartTime;
      totalResponseTime += batchResponseTime;
      console.log(`Batch ${batchIndex + 1} completed in ${batchResponseTime}ms`);
      
      // Add delay before next batch (except for the last batch)
      if (batchIndex < batches.length - 1) {
        console.log(`Waiting ${BATCH_DELAY_MS}ms before processing next batch`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    
    // Calculate performance metrics
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
    const avgResponseTime = batches.length > 0 ? totalResponseTime / batches.length : 0;
    
    // Only adjust parameters if we had good success (otherwise might be connection issues)
    if (successRate > 0.5) {
      // Adjust batch parameters based on performance
      adjustBatchParameters(successRate, avgResponseTime);
    } else {
      console.log(`Success rate too low (${successRate * 100}%), not adjusting batch parameters`);
    }

    // Convert miner data to leaderboard format
    const minerEntries = Object.entries(minerData);
    console.log(`Processing ${minerEntries.length} miner entries`);
    
    if (minerEntries.length === 0) {
      throw new Error('No miner data retrieved, possible blockchain connection issue');
    }
    
    // Convert entries to array format and sort
    const miners = minerEntries.map(([address, data]) => ({
      address,
      hashrate: data.hashrate.toString(),
      totalHashrate: data.hashrate.toString()
    })).sort((a, b) => {
      const hashrateA = BigInt(a.hashrate || "0");
      const hashrateB = BigInt(b.hashrate || "0");
      return hashrateB > hashrateA ? 1 : hashrateB < hashrateA ? -1 : 0;
    });

    // Update leaderboard data
    leaderboardData = {
      miners,
      totalHashrate: networkTotalHashrate ? networkTotalHashrate.toString() : totalHashrate.toString(),
      lastUpdated: new Date().toISOString(),
      status: {
        blockchain: isConnectedToBlockchain ? 'connected' : 'disconnected',
        lastUpdate: new Date().toISOString()
      }
    };
    
    // Update timestamp
    lastUpdateTime = Date.now();
    
    console.log(`Leaderboard updated successfully with ${miners.length} miners`);

    // After successful update, save to cache and update timestamps
    saveLeaderboardToCache(leaderboardData);
    lastFullUpdate = Date.now();
    console.log('Background update completed successfully');
    
    return { success: true, data: leaderboardData };
  } catch (error) {
    console.error('Error in background update:', error.message);
    return { success: false, error: error.message, data: leaderboardData };
  } finally {
    isUpdating = false;
  }
}

// Get mock data for testing and fallback
function getMockData() {
  const timestamp = new Date().toISOString();
  return {
    miners: [
      { address: '0x1234567890123456789012345678901234567890', totalHashrate: '25000', hashrate: '25000' },
      { address: '0x2345678901234567890123456789012345678901', totalHashrate: '15000', hashrate: '15000' },
      { address: '0x3456789012345678901234567890123456789012', totalHashrate: '10000', hashrate: '10000' },
      { address: '0x4567890123456789012345678901234567890123', totalHashrate: '5000', hashrate: '5000' },
      { address: '0x5678901234567890123456789012345678901234', totalHashrate: '2500', hashrate: '2500' }
    ],
    totalHashrate: '57500',
    lastUpdated: timestamp,
    status: {
      blockchain: 'connected',
      lastUpdate: timestamp
    }
  };
}

// Initialize on module load
console.log('Blockchain service initializing...');
initBlockchainConnection().then(connectedProvider => {
  if (connectedProvider) {
    console.log('Blockchain connection established');
    // First try to load cached data
    const cachedData = loadLeaderboardFromCache();
    if (cachedData) {
      console.log('Loaded initial data from cache');
      leaderboardData = cachedData;
    }
    // Start background update
    updateLeaderboard().catch(error => {
      console.error('Initial background update failed:', error.message);
    });
  } else {
    console.error('Failed to establish blockchain connection during initialization');
  }
});

// Dynamic batch adjustment based on performance
function adjustBatchParameters(successRate, responseTime) {
  // Default thresholds
  const GOOD_SUCCESS_RATE = 0.9; // 90% success
  const POOR_SUCCESS_RATE = 0.7; // 70% success
  const GOOD_RESPONSE_TIME = 2000; // 2 seconds
  const POOR_RESPONSE_TIME = 5000; // 5 seconds
  
  // Log current settings before adjustment
  console.log(`Current batch settings - Size: ${BATCH_SIZE}, Delay: ${BATCH_DELAY_MS}ms`);
  console.log(`Performance metrics - Success rate: ${successRate * 100}%, Avg response time: ${responseTime}ms`);
  
  // Adjust based on success rate and response time
  if (successRate >= GOOD_SUCCESS_RATE && responseTime <= GOOD_RESPONSE_TIME) {
    // Excellent performance - increase batch size, decrease delay
    BATCH_SIZE = Math.min(20, BATCH_SIZE + 2);
    BATCH_DELAY_MS = Math.max(500, BATCH_DELAY_MS - 200);
    console.log('Performance excellent - increasing batch size, decreasing delay');
  } else if (successRate < POOR_SUCCESS_RATE || responseTime > POOR_RESPONSE_TIME) {
    // Poor performance - decrease batch size, increase delay
    BATCH_SIZE = Math.max(5, BATCH_SIZE - 2);
    BATCH_DELAY_MS = Math.min(3000, BATCH_DELAY_MS + 500);
    console.log('Performance poor - decreasing batch size, increasing delay');
  } else {
    // Acceptable performance - make minor adjustments
    if (responseTime > GOOD_RESPONSE_TIME * 1.5) {
      BATCH_DELAY_MS = Math.min(2000, BATCH_DELAY_MS + 200);
      console.log('Response time slightly high - increasing delay');
    } else if (responseTime < GOOD_RESPONSE_TIME * 0.8) {
      BATCH_DELAY_MS = Math.max(800, BATCH_DELAY_MS - 100);
      console.log('Response time good - slightly decreasing delay');
    }
  }
  
  // Log new settings
  console.log(`Adjusted batch settings - Size: ${BATCH_SIZE}, Delay: ${BATCH_DELAY_MS}ms`);
}

// Wrapper function to handle contract calls with improved error handling
async function safeContractCall(contractFn, fallbackValue, errorMessage) {
  try {
    // Verify provider is working before making call
    if (!provider) {
      throw new Error('No provider available');
    }
    
    // Quick connection check before proceeding
    await provider.getBlockNumber();
    
    // Execute the contract call
    return await contractFn();
  } catch (error) {
    console.error(`${errorMessage}: ${error.message}`);
    
    // Decrease connection health on contract errors
    connectionHealthCounter = Math.max(connectionHealthCounter - 1, 0);
    
    // If health counter is too low due to contract errors, mark as disconnected
    if (connectionHealthCounter < CONNECTION_HEALTH_THRESHOLD && isConnectedToBlockchain) {
      console.log(`Connection degraded due to contract errors (health: ${connectionHealthCounter}/5)`);
      setBlockchainConnected(false);
      
      // Try to reconnect in background
      setTimeout(() => {
        initBlockchainConnection().catch(e => {
          console.error('Reconnection attempt failed:', e.message);
        });
      }, 1000);
    }
    
    return fallbackValue;
  }
}

// Function to fetch hashrate with retries
async function fetchHashrateWithRetries(contract, minerAddress, maxRetries = 5, delayMs = 2000) {
  let attempts = 0;
  let lastError = null;

  while (attempts < maxRetries) {
    try {
      // Increment attempt counter
      attempts++;
      
      // Call the contract function with a timeout
      const result = await safeContractCall(
        async () => await contract.playerHashrate(minerAddress),
        null,
        `Error fetching hashrate for ${minerAddress}`
      );
      
      if (result === null) {
        throw new Error('Contract call returned null');
      }
      
      // Return the hashrate value directly without unit conversion
      return result.toString();
    } catch (error) {
      lastError = error;
      
      // Only log error on last attempt to avoid log spam
      if (attempts >= maxRetries) {
        console.error(`Failed to fetch hashrate for ${minerAddress} after ${attempts} attempts`);
      }
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // All attempts failed
  throw lastError || new Error(`Failed to fetch hashrate for ${minerAddress}`);
}

module.exports = {
  get isConnectedToBlockchain() { return isConnectedToBlockchain; },
  get leaderboardData() { 
    console.log('Accessing leaderboardData:', {
      hasData: !!leaderboardData,
      hasMiners: !!leaderboardData?.miners,
      minersLength: leaderboardData?.miners?.length || 0,
      totalHashrate: leaderboardData?.totalHashrate || '0'
    });

    // If no data is available yet, return mock data
    if (!leaderboardData || !leaderboardData.miners || leaderboardData.miners.length === 0) {
      console.log('No leaderboard data available, returning mock data');
      const mockData = getMockData();
      console.log('Mock data:', {
        hasMiners: !!mockData.miners,
        minersLength: mockData.miners.length,
        totalHashrate: mockData.totalHashrate
      });
      return mockData;
    }

    console.log('Returning real leaderboard data with', leaderboardData.miners.length, 'miners');
    return leaderboardData; 
  },
  get lastUpdateTime() { return lastUpdateTime; },
  updateLeaderboard,
  initBlockchainConnection,
  setBlockchainConnected,
  BATCH_SIZE,
  BATCH_DELAY_MS,
  adjustBatchParameters,
  getMockData
};