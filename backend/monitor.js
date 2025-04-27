/**
 * BIGCOIN Mining Leaderboard - Server Health Monitor
 * 
 * This script checks the server health and sends alerts if issues are detected.
 * It can be run as a cron job or using a process manager like PM2.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  healthEndpoint: 'http://localhost:3000/api/health',
  leaderboardEndpoint: 'http://localhost:3000/api/leaderboard',
  checkInterval: 5 * 60 * 1000, // 5 minutes
  logPath: path.join(__dirname, 'logs', 'monitor.log'),
  maxRetries: 3,
  retryDelay: 30 * 1000, // 30 seconds
  alerts: {
    logToFile: true,
    logToConsole: true,
    // Add email or webhook configurations here if needed
    // email: {
    //   enabled: false,
    //   recipients: ['admin@example.com'],
    //   from: 'monitor@example.com',
    //   subject: 'BIGCOIN Mining Leaderboard Alert'
    // },
    // webhook: {
    //   enabled: false,
    //   url: 'https://hooks.slack.com/services/XXX/YYY/ZZZ',
    // }
  }
};

// Ensure log directory exists
const logDir = path.dirname(CONFIG.logPath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Make an HTTP request with retry logic
 */
async function makeRequest(url, retries = CONFIG.maxRetries) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        if (retries > 0) {
          console.log(`Request failed with status ${res.statusCode}, retrying in ${CONFIG.retryDelay / 1000}s...`);
          setTimeout(() => {
            makeRequest(url, retries - 1).then(resolve).catch(reject);
          }, CONFIG.retryDelay);
          return;
        }
        reject(new Error(`HTTP request failed with status code ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      if (retries > 0) {
        console.log(`Request error: ${err.message}, retrying in ${CONFIG.retryDelay / 1000}s...`);
        setTimeout(() => {
          makeRequest(url, retries - 1).then(resolve).catch(reject);
        }, CONFIG.retryDelay);
        return;
      }
      reject(new Error(`HTTP request failed: ${err.message}`));
    });
  });
}

/**
 * Log a message to file and console
 */
function logMessage(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${isError ? 'ERROR' : 'INFO'}: ${message}\n`;
  
  if (CONFIG.alerts.logToConsole) {
    if (isError) {
      console.error(logEntry);
    } else {
      console.log(logEntry);
    }
  }
  
  if (CONFIG.alerts.logToFile) {
    fs.appendFileSync(CONFIG.logPath, logEntry);
  }
  
  // Add email or webhook alert logic here if needed
}

/**
 * Check server health
 */
async function checkServerHealth() {
  try {
    // Check health endpoint
    const healthData = await makeRequest(CONFIG.healthEndpoint);
    if (healthData.status !== 'ok') {
      logMessage(`Health check failed: ${JSON.stringify(healthData)}`, true);
      return false;
    }
    
    // Check blockchain connection
    if (healthData.blockchain !== 'connected') {
      logMessage(`Blockchain connection issue: ${healthData.blockchain}`, true);
      // This is not a critical failure as the app can use mock data
    }
    
    // Check leaderboard data
    const leaderboardData = await makeRequest(CONFIG.leaderboardEndpoint);
    if (!leaderboardData.leaderboard || !Array.isArray(leaderboardData.leaderboard)) {
      logMessage(`Invalid leaderboard data format: ${JSON.stringify(leaderboardData)}`, true);
      return false;
    }
    
    if (leaderboardData.leaderboard.length === 0) {
      logMessage('Leaderboard is empty, which may indicate an issue', true);
      return false;
    }
    
    // Check last update time
    const lastUpdate = new Date(leaderboardData.lastUpdate);
    const now = new Date();
    const timeDiff = now - lastUpdate;
    
    // Alert if last update was more than 5 minutes ago (data should update every 2 minutes)
    if (timeDiff > 5 * 60 * 1000) {
      logMessage(`Stale leaderboard data: Last update was ${Math.round(timeDiff / 1000 / 60)} minutes ago`, true);
      return false;
    }
    
    // All checks passed
    logMessage('Health check passed. Server is functioning properly.');
    return true;
  } catch (error) {
    logMessage(`Health check failed with error: ${error.message}`, true);
    return false;
  }
}

/**
 * Main monitoring function
 */
async function monitor() {
  logMessage('Server monitor started');
  
  // Initial check
  await checkServerHealth();
  
  // Set up interval for regular checks
  setInterval(async () => {
    await checkServerHealth();
  }, CONFIG.checkInterval);
}

// Start monitoring
monitor().catch(err => {
  logMessage(`Monitoring failed to start: ${err.message}`, true);
  process.exit(1);
}); 