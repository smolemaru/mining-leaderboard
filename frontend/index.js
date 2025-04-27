// Mining Leaderboard Frontend JS

document.addEventListener('DOMContentLoaded', function() {
  // Get references to UI elements
  const minerTableBody = document.getElementById('minerTableBody');
  const totalNetworkHashrate = document.getElementById('totalNetworkHashrate');
  const refreshButton = document.getElementById('refreshButton');
  const lastUpdateEl = document.getElementById('lastUpdate');
  const blockchainStatus = document.getElementById('blockchainStatus');
  const edgeConfigStatus = document.getElementById('edgeConfigStatus');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorMessage = document.getElementById('errorMessage');
  
  // Function to format hashrate
  function formatHashrate(hashrate) {
    const number = parseFloat(hashrate);
    if (isNaN(number)) return '0 H/s';
    
    if (number >= 1e12) {
      return (number / 1e12).toFixed(2) + ' TH/s';
    } else if (number >= 1e9) {
      return (number / 1e9).toFixed(2) + ' GH/s';
    } else if (number >= 1e6) {
      return (number / 1e6).toFixed(2) + ' MH/s';
    } else if (number >= 1e3) {
      return (number / 1e3).toFixed(2) + ' KH/s';
    } else {
      return number.toFixed(2) + ' H/s';
    }
  }
  
  // Function to generate a shortened address display
  function shortenAddress(address) {
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  // Function to calculate percentage of network
  function calculatePercentage(hashrate, totalHashrate) {
    if (!totalHashrate || totalHashrate === '0') return '0%';
    
    const percentage = (parseFloat(hashrate) / parseFloat(totalHashrate)) * 100;
    return percentage.toFixed(2) + '%';
  }
  
  // Function to copy address to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      // Show toast notification
      const toast = document.createElement('div');
      toast.className = 'position-fixed bottom-0 end-0 p-3';
      toast.innerHTML = `
        <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
          <div class="toast-header">
            <strong class="me-auto">Copied!</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
          </div>
          <div class="toast-body">
            Address copied to clipboard
          </div>
        </div>
      `;
      document.body.appendChild(toast);
      
      // Remove toast after 3 seconds
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 3000);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }
  
  // Function to update the UI with leaderboard data
  function updateUI(data) {
    // Update total network hashrate
    totalNetworkHashrate.textContent = formatHashrate(data.totalHashrate);
    
    // Update miners table
    minerTableBody.innerHTML = '';
    
    if (!data.miners || data.miners.length === 0) {
      minerTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">No miners found</td>
        </tr>
      `;
      return;
    }
    
    // Sort miners by hashrate descending
    const sortedMiners = [...data.miners].sort((a, b) => {
      return parseFloat(b.totalHashrate) - parseFloat(a.totalHashrate);
    });
    
    // Add each miner to the table
    sortedMiners.forEach((miner, index) => {
      const row = document.createElement('tr');
      
      // Determine badge color based on rank
      let badgeColor = 'bg-secondary';
      if (index === 0) badgeColor = 'bg-warning text-dark'; // Gold
      else if (index === 1) badgeColor = 'bg-light text-dark'; // Silver
      else if (index === 2) badgeColor = 'bg-danger'; // Bronze
      
      row.innerHTML = `
        <td>
          <span class="rank-badge ${badgeColor}">${index + 1}</span>
        </td>
        <td>
          <div class="d-flex align-items-center">
            <span class="me-2">${shortenAddress(miner.address)}</span>
            <button class="copy-btn" data-address="${miner.address}">
              <i class="bi bi-clipboard"></i>
            </button>
          </div>
        </td>
        <td>${formatHashrate(miner.totalHashrate)}</td>
        <td>${calculatePercentage(miner.totalHashrate, data.totalHashrate)}</td>
        <td>${miner.workerCount || '-'}</td>
      `;
      
      minerTableBody.appendChild(row);
    });
    
    // Add event listeners to copy buttons
    document.querySelectorAll('.copy-btn').forEach(button => {
      button.addEventListener('click', function() {
        copyToClipboard(this.dataset.address);
      });
    });
  }
  
  // Function to update status indicators
  function updateStatusIndicators(data) {
    // Update blockchain status indicator
    if (data.status && data.status.blockchain) {
      blockchainStatus.className = 'status-indicator ' + 
        (data.status.blockchain === 'connected' ? 'connected' : 'disconnected');
      blockchainStatus.title = 'Blockchain: ' + data.status.blockchain;
    }
    
    // Update edge config status indicator
    if (data.status && data.status.edgeConfig) {
      edgeConfigStatus.className = 'status-indicator ' + 
        (data.status.edgeConfig === 'configured' ? 'connected' : 'disconnected');
      edgeConfigStatus.title = 'Edge Config: ' + data.status.edgeConfig;
    }
    
    // Update last update time
    if (data.status && data.status.lastUpdate) {
      const lastUpdateTime = new Date(data.status.lastUpdate);
      lastUpdateEl.textContent = lastUpdateTime.toLocaleTimeString();
    }
  }
  
  // Function to fetch leaderboard data from the API
  async function fetchLeaderboardData() {
    // Show loading indicator
    loadingIndicator.style.display = 'flex';
    errorMessage.style.display = 'none';
    
    try {
      const response = await fetch('/api/leaderboard');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Hide loading indicator
      loadingIndicator.style.display = 'none';
      
      // Update the UI with the data
      updateUI(data);
      
      // Update status indicators
      updateStatusIndicators(data);
      
      return data;
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      
      // Hide loading indicator
      loadingIndicator.style.display = 'none';
      
      // Show error message
      errorMessage.style.display = 'block';
      errorMessage.textContent = 'Failed to load leaderboard data: ' + error.message;
      
      return null;
    }
  }
  
  // Initial data fetch
  fetchLeaderboardData();
  
  // Add event listener to refresh button
  refreshButton.addEventListener('click', function() {
    fetchLeaderboardData();
  });
  
  // Set up auto-refresh every 60 seconds
  setInterval(fetchLeaderboardData, 60000);
}); 