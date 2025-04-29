const express = require('express');
const ethers = require('ethers');
const cors = require('cors');
const path = require('path');
const blockchainService = require('./services/blockchain');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST'], // Allow specific methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow specific headers
}));

// Add CSP headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://cdn.jsdelivr.net; " +
    "connect-src 'self' https://api.mainnet.abs.xyz https://rpc.ankr.com https://public-abs-rpc.haqq.network"
  );
  next();
});

app.use(express.json());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Import and use API routes
const leaderboardRoutes = require('./routes/leaderboard');
app.use('/api/leaderboard', leaderboardRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    blockchain: blockchainService.isConnectedToBlockchain ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  };
  
  res.json(health);
});

// Root route - redirect to static HTML if not accessed programmatically
app.get('/', (req, res) => {
  // Check if request is from a browser (wants HTML) or programmatic (wants JSON)
  const userAgent = req.headers['user-agent'] || '';
  const acceptHeader = req.headers.accept || '';
  
  // If the request explicitly wants JSON or comes from a non-browser, send JSON
  if (acceptHeader.includes('application/json') || !userAgent.includes('Mozilla')) {
    res.json({
      name: 'Mining Leaderboard API',
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

// Route for simulating hashrate updates (for testing)
app.post('/api/mock/update-hashrate', (req, res) => {
  const { address, hashrate } = req.body;
  
  if (!address || !hashrate) {
    return res.status(400).json({ success: false, message: 'Address and hashrate are required' });
  }
  
  // Get current leaderboard data
  const leaderboardData = blockchainService.leaderboardData;
  
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
  leaderboardData.miners.sort((a, b) => Number(b.totalHashrate) - Number(a.totalHashrate));
  
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
    // Execute update using the blockchain service
    console.log('Executing cron job to update leaderboard data');
    await blockchainService.updateLeaderboard(true); // Force update
    
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

// Export the Express API
module.exports = app; 