const ethers = require('ethers');

// Determine if we're using ethers v5 or v6
const isEthersV6 = ethers.version && parseInt(ethers.version.split('.')[0]) >= 6;
console.log(`Using ethers.js version: ${isEthersV6 ? 'v6+' : 'v5'}`);

// Connect to blockchain provider
const RPC_URL = 'https://api.mainnet.abs.xyz';
let provider;

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
  process.exit(1);
}

// Contract details
const CONTRACT_ADDRESS = '0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705';

// Mining contract interface - try different functions that might exist
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

async function checkContract() {
  try {
    // Initialize contract instance
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    console.log('Contract initialized');
    
    // Check the network
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name || 'unknown'} (${network.chainId})`);
    
    console.log('\nChecking contract functions...');
    
    // Try view functions first - but don't assume they exist
    
    // Check if totalHashrate exists
    try {
      const totalHashrate = await contract.totalHashrate();
      console.log(`Total hashrate: ${totalHashrate.toString()}`);
    } catch (err) {
      console.log(`❌ Failed: totalHashrate() - ${err.reason || err.message}`);
    }
    
    // Check if uniqueMinerCount exists
    try {
      const uniqueMinerCount = await contract.uniqueMinerCount();
      console.log(`Unique miner count: ${uniqueMinerCount.toString()}`);
    } catch (err) {
      console.log(`❌ Failed: uniqueMinerCount() - ${err.reason || err.message}`);
    }
    
    // Try miningHasStarted
    try {
      const miningStarted = await contract.miningHasStarted();
      console.log(`Mining has started: ${miningStarted}`);
    } catch (err) {
      console.log(`❌ Failed: miningHasStarted() - ${err.reason || err.message}`);
    }
    
    // Try startBlock
    try {
      const startBlock = await contract.startBlock();
      console.log(`Start block: ${startBlock.toString()}`);
    } catch (err) {
      console.log(`❌ Failed: startBlock() - ${err.reason || err.message}`);
    }
    
    // Try all functions from the ABI to see which ones work
    const functions = CONTRACT_ABI
      .filter(item => item.type === 'function')
      .map(item => item.name);
    
    for (const funcName of functions) {
      // Skip if we already tried this function above
      if (['totalHashrate', 'uniqueMinerCount', 'miningHasStarted', 'startBlock'].includes(funcName)) {
        continue;
      }
      
      try {
        // Special case for functions that need parameters
        if (funcName === 'getTopMiners') {
          console.log(`\nTrying ${funcName}(20)...`);
          const result = await contract.getTopMiners(20);
          console.log(`✅ Success! Found ${result.length} miners`);
          console.log('First few miners:', result.slice(0, 3));
        } 
        else if (funcName === 'miners' || funcName === 'playerHashrate') {
          console.log(`\nTrying ${funcName}(contract_address)...`);
          const result = await contract[funcName](CONTRACT_ADDRESS);
          console.log(`✅ Success! Result:`, result.toString());
          
          // Try a few more addresses
          const testAddresses = [
            '0x1234567890123456789012345678901234567890',
            '0x2345678901234567890123456789012345678901'
          ];
          
          for (const addr of testAddresses) {
            try {
              const addrResult = await contract[funcName](addr);
              console.log(`${funcName}(${addr.substring(0, 10)}...): ${addrResult.toString()}`);
            } catch (err) {
              console.log(`${funcName}(${addr.substring(0, 10)}...): Failed`);
            }
          }
        }
        else {
          console.log(`\nTrying ${funcName}()...`);
          const result = await contract[funcName]();
          console.log(`✅ Success! Result:`, result.toString());
        }
      } catch (error) {
        console.log(`❌ Failed: ${funcName}() - ${error.reason || error.message}`);
      }
    }
    
    // Look for events to find miners
    console.log('\nScanning for events to find miners...');
    
    try {
      // Get the most recent blocknumber
      const latestBlock = await provider.getBlockNumber();
      console.log(`Latest block: ${latestBlock}`);
      
      // We'll look back ~10k blocks to avoid timeout
      const fromBlock = Math.max(1, latestBlock - 10000); 
      console.log(`Scanning from block ${fromBlock} to ${latestBlock}`);
      
      // Define all event types we want to try
      const eventTypes = [
        'PlayerHashrateIncreased',
        'PlayerHashrateDecreased',
        'MinerBought',
        'InitialFacilityPurchased',
        'RewardsClaimed',
        'FacilityBought'
      ];
      
      // Extract event definitions from ABI
      const eventDefinitions = CONTRACT_ABI.filter(item => item.type === 'event');
      console.log(`Found ${eventDefinitions.length} event definitions in ABI`);
      
      // Set to track unique miner addresses
      const minerAddresses = new Set();
      
      // Try each event type
      for (const eventType of eventTypes) {
        try {
          // Check if the event filter exists
          if (contract.filters[eventType]) {
            const filter = contract.filters[eventType]();
            console.log(`\nSearching for ${eventType} events...`);
            
            const events = await contract.queryFilter(filter, fromBlock, latestBlock);
            console.log(`Found ${events.length} ${eventType} events`);
            
            // Sample the first few events
            if (events.length > 0) {
              try {
                console.log(`Sample ${eventType} event arguments:`, events[0].args);
              } catch (err) {
                console.log(`Cannot display sample event properly`);
              }
              
              // Extract addresses from events
              events.forEach(event => {
                try {
                  const args = event.args || [];
                  
                  // Find player address based on event type
                  if (args.player) {
                    minerAddresses.add(args.player.toLowerCase());
                  }
                  // For any other args that look like addresses
                  for (const key in args) {
                    const value = args[key];
                    if (value && typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
                      minerAddresses.add(value.toLowerCase());
                    }
                  }
                } catch (err) {
                  // Ignore errors processing individual events
                }
              });
            }
          } else {
            console.log(`\n❌ ${eventType} event filter not available`);
          }
        } catch (err) {
          console.log(`Error getting ${eventType} events:`, err.message);
        }
      }
      
      console.log(`\nFound ${minerAddresses.size} unique miner addresses from events`);
      
      // Display first 5 addresses if found
      if (minerAddresses.size > 0) {
        const addressArray = Array.from(minerAddresses);
        console.log('Sample addresses:', addressArray.slice(0, 5));
        
        // Try to get hashrate for these addresses
        console.log('\nChecking hashrates for sample addresses:');
        
        for (let i = 0; i < Math.min(5, addressArray.length); i++) {
          const address = addressArray[i];
          try {
            // Try playerHashrate first
            try {
              const hashrate = await contract.playerHashrate(address);
              console.log(`Address ${address.substring(0, 10)}... hashrate: ${hashrate.toString()}`);
            } catch (err) {
              // If playerHashrate fails, try miners mapping
              try {
                const hashrate = await contract.miners(address);
                console.log(`Address ${address.substring(0, 10)}... miners mapping value: ${hashrate.toString()}`);
              } catch (minerErr) {
                console.log(`Address ${address.substring(0, 10)}... hashrate: Could not retrieve`);
              }
            }
          } catch (err) {
            console.log(`Error getting hashrate for ${address.substring(0, 10)}...: ${err.message}`);
          }
        }
      }
      
    } catch (err) {
      console.log(`Error scanning for events: ${err.message}`);
    }
    
    console.log('\nContract check complete!');
    
  } catch (error) {
    console.error('Error checking contract:', error);
  }
}

checkContract().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 