const ethers = require('ethers');

// Contract details
const CONTRACT_ADDRESS = '0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705';
const CONTRACT_ABI = [
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"playerHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalHashrate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

// RPC URLs
const RPC_URLS = [
  'https://api.mainnet.abs.xyz',
  'https://rpc.ankr.com/abstract',
  'https://public-abs-rpc.haqq.network'
];

async function checkContract() {
  console.log('Starting contract check...');
  console.log('Using ethers version:', ethers.version || 'v5 (no version property)');
  
  for (const rpcUrl of RPC_URLS) {
    try {
      console.log(`Trying RPC endpoint: ${rpcUrl}`);
      
      // Create provider based on ethers version
      let provider;
      if (ethers.version && parseInt(ethers.version.split('.')[0]) >= 6) {
        provider = new ethers.JsonRpcProvider(rpcUrl);
      } else {
        provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      }
      
      // Connect to contract
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      
      // Get total hashrate
      console.log('Fetching total network hashrate...');
      const totalHashrate = await contract.totalHashrate();
      console.log(`Total network hashrate from contract: ${totalHashrate.toString()}`);
      
      // Format with commas for readability
      const formattedHashrate = parseInt(totalHashrate.toString()).toLocaleString() + ' GH/s';
      console.log(`Formatted total hashrate: ${formattedHashrate}`);
      
      // Get a sample miner hashrate for comparison
      const sampleMiner = '0x85046ee1e489d7d3d9464ff664ff3959c5c86479'; // Top miner from logs
      const minerHashrate = await contract.playerHashrate(sampleMiner);
      console.log(`Sample miner (${sampleMiner}) hashrate: ${minerHashrate.toString()}`);
      
      // Format miner hashrate with commas
      const formattedMinerHashrate = parseInt(minerHashrate.toString()).toLocaleString() + ' GH/s';
      console.log(`Formatted miner hashrate: ${formattedMinerHashrate}`);
      
      // Calculate percentage
      const percentage = Number(BigInt(minerHashrate) * BigInt(1000000) / BigInt(totalHashrate)) / 10000;
      console.log(`Miner percentage of network: ${percentage.toFixed(6)}%`);
      
      // Success for this RPC
      console.log('RPC check successful!');
      return;
    } catch (error) {
      console.error(`Error with RPC ${rpcUrl}:`, error.message);
    }
  }
  
  console.error('All RPC endpoints failed');
}

checkContract().catch(console.error); 