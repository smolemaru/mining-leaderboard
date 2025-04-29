const http = require('http');

// Make a request to the local API
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/leaderboard',
  method: 'GET'
};

console.log('Fetching data from API...');
const req = http.request(options, (res) => {
  console.log(`API Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const responseData = JSON.parse(data);
      console.log('API Response received:');
      console.log('- Status:', responseData.status ? responseData.status.blockchain : 'unknown');
      console.log('- Miners count:', responseData.miners ? responseData.miners.length : 0);
      if (responseData.miners && responseData.miners.length > 0) {
        console.log('- First 3 miners:');
        responseData.miners.slice(0, 3).forEach((miner, i) => {
          console.log(`  #${i+1}: ${miner.address} - Hashrate: ${miner.totalHashrate || miner.hashrate}`);
        });
      } else {
        console.log('- No miners in the response');
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw data:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`API Request Error: ${e.message}`);
});

req.end(); 