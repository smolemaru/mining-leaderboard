#!/usr/bin/env node

/**
 * BIGCOIN Mining Leaderboard - Deployment Verification Script
 * 
 * This script verifies that the deployment is working correctly by:
 * 1. Checking the frontend is accessible
 * 2. Checking the backend health endpoint
 * 3. Checking the leaderboard data
 * 4. Validating the contract connection
 */

const http = require('http');
const https = require('https');

// Configuration - modify these values for your deployment
const CONFIG = {
  frontend: {
    url: 'http://localhost',
    expectedStatus: 200
  },
  backend: {
    healthUrl: 'http://localhost:3000/api/health',
    leaderboardUrl: 'http://localhost:3000/api/leaderboard',
    expectedStatus: 200
  },
  contract: {
    address: '0x09Ee83D8fA0f3F03f2aefad6a82353c1e5DE5705'
  },
  timeoutMs: 10000 // 10 seconds
};

// Color formatting for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Results counter
const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

/**
 * Make an HTTP request
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: CONFIG.timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          };
          
          // Try to parse JSON if content-type is application/json
          if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
            result.json = JSON.parse(data);
          }
          
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to process response: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${url} timed out after ${CONFIG.timeoutMs}ms`));
    });
  });
}

/**
 * Log test results
 */
function logTest(name, success, message, warning = false) {
  const status = success ? `${colors.green}PASS${colors.reset}` : warning ? `${colors.yellow}WARN${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
  console.log(`[${status}] ${name}: ${message}`);
  
  if (success) {
    results.passed++;
  } else if (warning) {
    results.warnings++;
  } else {
    results.failed++;
  }
}

/**
 * Verify frontend
 */
async function verifyFrontend() {
  try {
    const response = await makeRequest(CONFIG.frontend.url);
    
    // Check status code
    if (response.statusCode !== CONFIG.frontend.expectedStatus) {
      logTest('Frontend Accessibility', false, `Unexpected status code: ${response.statusCode}`);
      return false;
    }
    
    // Check if the response contains expected HTML content
    if (!response.data.includes('<!DOCTYPE html>') || !response.data.includes('<html')) {
      logTest('Frontend Content', false, 'Response does not appear to be HTML');
      return false;
    }
    
    // Check if it contains the expected title or application name
    if (!response.data.includes('BIGCOIN') && !response.data.includes('Mining Leaderboard')) {
      logTest('Frontend Content', false, 'Response does not contain expected application title');
      return false;
    }
    
    logTest('Frontend Accessibility', true, 'Frontend is accessible and returns expected HTML content');
    return true;
  } catch (error) {
    logTest('Frontend Accessibility', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Verify backend health
 */
async function verifyBackendHealth() {
  try {
    const response = await makeRequest(CONFIG.backend.healthUrl);
    
    // Check status code
    if (response.statusCode !== CONFIG.backend.expectedStatus) {
      logTest('Backend Health', false, `Unexpected status code: ${response.statusCode}`);
      return false;
    }
    
    // Check if the response contains expected JSON data
    if (!response.json || !response.json.status) {
      logTest('Backend Health', false, 'Response does not contain expected health data');
      return false;
    }
    
    // Check status is ok
    if (response.json.status !== 'ok') {
      logTest('Backend Health', false, `Unexpected status: ${response.json.status}`);
      return false;
    }
    
    // Check blockchain connection (warning only)
    if (response.json.blockchain !== 'connected') {
      logTest('Blockchain Connection', false, `Blockchain is not connected: ${response.json.blockchain}`, true);
    } else {
      logTest('Blockchain Connection', true, 'Blockchain is connected');
    }
    
    // Check contract address
    if (response.json.contract !== CONFIG.contract.address) {
      logTest('Contract Address', false, `Unexpected contract address: ${response.json.contract}`, true);
    } else {
      logTest('Contract Address', true, 'Contract address matches expected value');
    }
    
    logTest('Backend Health', true, 'Backend health endpoint is accessible and returns ok status');
    return true;
  } catch (error) {
    logTest('Backend Health', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Verify leaderboard data
 */
async function verifyLeaderboard() {
  try {
    const response = await makeRequest(CONFIG.backend.leaderboardUrl);
    
    // Check status code
    if (response.statusCode !== CONFIG.backend.expectedStatus) {
      logTest('Leaderboard API', false, `Unexpected status code: ${response.statusCode}`);
      return false;
    }
    
    // Check if the response contains expected JSON data
    if (!response.json || !response.json.leaderboard || !Array.isArray(response.json.leaderboard)) {
      logTest('Leaderboard API', false, 'Response does not contain expected leaderboard data');
      return false;
    }
    
    // Check if leaderboard has data
    if (response.json.leaderboard.length === 0) {
      logTest('Leaderboard Data', false, 'Leaderboard is empty, which may indicate an issue', true);
    } else {
      logTest('Leaderboard Data', true, `Leaderboard contains ${response.json.leaderboard.length} miners`);
      
      // Check a sample miner
      const sampleMiner = response.json.leaderboard[0];
      if (!sampleMiner.address || !sampleMiner.hashrate) {
        logTest('Miner Data', false, 'Miner data does not contain expected fields');
      } else {
        logTest('Miner Data', true, 'Miner data contains expected fields');
      }
    }
    
    // Check last update time
    if (!response.json.lastUpdate) {
      logTest('Last Update', false, 'Response does not contain lastUpdate timestamp');
      return false;
    }
    
    const lastUpdate = new Date(response.json.lastUpdate);
    const now = new Date();
    const timeDiff = now - lastUpdate;
    
    // Check if data is recent (warning only)
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      logTest('Data Freshness', false, `Data was last updated ${Math.round(timeDiff / 1000 / 60)} minutes ago`, true);
    } else {
      logTest('Data Freshness', true, `Data was updated recently (${Math.round(timeDiff / 1000)} seconds ago)`);
    }
    
    logTest('Leaderboard API', true, 'Leaderboard API is accessible and returns expected data format');
    return true;
  } catch (error) {
    logTest('Leaderboard API', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Main verification function
 */
async function verifyDeployment() {
  console.log(`${colors.cyan}==================================================${colors.reset}`);
  console.log(`${colors.cyan}  BIGCOIN Mining Leaderboard Deployment Verifier  ${colors.reset}`);
  console.log(`${colors.cyan}==================================================${colors.reset}`);
  console.log(`Frontend URL: ${CONFIG.frontend.url}`);
  console.log(`Backend API: ${CONFIG.backend.healthUrl}`);
  console.log(`${colors.cyan}==================================================${colors.reset}\n`);
  
  // Run verification checks
  await verifyFrontend();
  await verifyBackendHealth();
  await verifyLeaderboard();
  
  // Print summary
  console.log(`\n${colors.cyan}==================================================${colors.reset}`);
  console.log(`${colors.cyan}                 VERIFICATION SUMMARY                 ${colors.reset}`);
  console.log(`${colors.cyan}==================================================${colors.reset}`);
  console.log(`Tests passed: ${colors.green}${results.passed}${colors.reset}`);
  console.log(`Tests failed: ${colors.red}${results.failed}${colors.reset}`);
  console.log(`Warnings: ${colors.yellow}${results.warnings}${colors.reset}`);
  
  if (results.failed > 0) {
    console.log(`\n${colors.red}Deployment verification failed with ${results.failed} error(s)${colors.reset}`);
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log(`\n${colors.yellow}Deployment verification passed with ${results.warnings} warning(s)${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.green}Deployment verification successful!${colors.reset}`);
    process.exit(0);
  }
}

// Run the verification
verifyDeployment().catch(error => {
  console.error(`${colors.red}Verification process failed: ${error.message}${colors.reset}`);
  process.exit(1);
}); 