// Mining Leaderboard Frontend JS

document.addEventListener('DOMContentLoaded', function() {
  // Get references to UI elements
  const minerTableBody = document.getElementById('minerTableBody');
  const totalNetworkHashrate = document.getElementById('totalNetworkHashrate');
  const refreshButton = document.getElementById('refreshButton');
  const lastUpdateEl = document.getElementById('lastUpdate');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorMessage = document.getElementById('errorMessage');
  const minerSearchInput = document.getElementById('minerSearchInput');
  const clearSearchButton = document.getElementById('clearSearchButton');
  const displayedMinersCount = document.getElementById('displayedMinersCount');
  const totalMinersCount = document.getElementById('totalMinersCount');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const paginationInfo = document.getElementById('paginationInfo');
  
  // Variables for miner display management
  let allMiners = []; // Store all miners from the API
  let filteredMiners = []; // Miners after search filtering
  let currentPage = 1;
  let minersPerPage = 50; // Default miners per page
  
  // Function to format hashrate
  function formatHashrate(hashrate) {
    const formattedNumber = parseInt(hashrate).toLocaleString();
    return formattedNumber + ' GH/s';
  }
  
  // Function to generate a shortened address display
  function shortenAddress(address) {
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  // Generate links for AbScan, Game Room, and Abstract Profile
  function generateLinks(address) {
    const abscanLink = `https://abscan.org/address/${address}`;
    const gameRoomLink = `https://www.bigcoin.tech/room/${address}`;
    const abstractProfileLink = `https://portal.abs.xyz/profile/${address}`;
    
    return {
      abscanLink,
      gameRoomLink,
      abstractProfileLink
    };
  }
  
  // Function to calculate percentage of network
  function calculatePercentage(hashrate, totalHashrate) {
    if (!totalHashrate || totalHashrate === '0') return '0%';
    
    try {
      const minerHashrate = BigInt(hashrate);
      const networkHashrate = BigInt(totalHashrate);
      
      if (networkHashrate === 0n) return '0%';
      
      const percentage = Number(minerHashrate * BigInt(100000000) / networkHashrate) / 1000000;
      
      if (percentage < 0.000001) {
        return '< 0.000001%';
      } else if (percentage < 0.0001) {
        return percentage.toFixed(6) + '%';
      } else if (percentage < 0.01) {
        return percentage.toFixed(5) + '%';
      } else if (percentage < 0.1) {
        return percentage.toFixed(4) + '%';
      } else if (percentage < 1) {
        return percentage.toFixed(3) + '%';
      } else {
        return percentage.toFixed(2) + '%';
      }
    } catch (e) {
      console.error('Error calculating percentage:', e);
      return '0%';
    }
  }
  
  // Function to copy address to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
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
      
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 3000);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }
  
  // Function to filter miners based on search input
  function filterMiners() {
    const searchTerm = minerSearchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
      filteredMiners = [...allMiners];
    } else {
      filteredMiners = allMiners.filter(miner => 
        miner.address.toLowerCase().includes(searchTerm)
      );
    }
    
    // Update displayed count
    displayedMinersCount.textContent = filteredMiners.length;
    totalMinersCount.textContent = allMiners.length;
    
    // Reset to first page when filtering
    currentPage = 1;
    
    // Render the filtered miners
    renderMiners();
  }
  
  // Function to render the current page of miners
  function renderMiners() {
    // Calculate pagination
    const startIndex = (currentPage - 1) * minersPerPage;
    const endIndex = Math.min(startIndex + minersPerPage, filteredMiners.length);
    const currentMiners = filteredMiners.slice(startIndex, endIndex);
    
    // Update pagination info
    paginationInfo.textContent = `Page ${currentPage} of ${Math.ceil(filteredMiners.length / minersPerPage)}`;
    
    // Enable/disable pagination buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = endIndex >= filteredMiners.length;
    
    // Clear the table
    minerTableBody.innerHTML = '';
    
    if (currentMiners.length === 0) {
      minerTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center">No miners found</td>
        </tr>
      `;
      return;
    }
    
    // Get the real total network hashrate
    const networkTotalHashrate = allMiners[0].networkTotalHashrate || "0";
    
    // Add miners to the table
    currentMiners.forEach((miner, index) => {
      const row = document.createElement('tr');
      
      // Global rank (position in the allMiners array)
      const globalRank = allMiners.findIndex(m => m.address === miner.address) + 1;
      
      // Determine badge color based on global rank
      let badgeColor = 'bg-secondary';
      if (globalRank === 1) badgeColor = 'bg-warning text-dark'; // Gold
      else if (globalRank === 2) badgeColor = 'bg-light text-dark'; // Silver
      else if (globalRank === 3) badgeColor = 'bg-danger'; // Bronze
      
      // Generate links for this miner
      const links = generateLinks(miner.address);
      
      // Ensure we have a valid hashrate value for display
      const minerHashrate = miner.totalHashrate || miner.hashrate || "0";
      
      row.innerHTML = `
        <td>
          <span class="rank-badge ${badgeColor}">${globalRank}</span>
        </td>
        <td class="miner-address-cell">
          <div class="d-flex align-items-center">
            <a href="${links.abscanLink}" target="_blank" class="text-decoration-none text-info me-2">${shortenAddress(miner.address)}</a>
            <button class="copy-btn" data-address="${miner.address}">
              <i class="bi bi-clipboard"></i>
            </button>
            <div class="ms-2 miner-links">
              <a href="${links.gameRoomLink}" class="btn btn-sm btn-outline-success me-1" target="_blank">Game Room</a>
              <a href="${links.abstractProfileLink}" class="btn btn-sm btn-outline-primary" target="_blank">Abstract Profile</a>
            </div>
          </div>
        </td>
        <td>${formatHashrate(minerHashrate)}</td>
        <td>${calculatePercentage(minerHashrate, networkTotalHashrate)}</td>
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
  
  // Function to update network stats
  function updateNetworkStats(totalHashrate, minerCount) {
    totalNetworkHashrate.textContent = formatHashrate(totalHashrate);
    totalMinersCount.textContent = minerCount.toLocaleString();
  }
  
  // Function to fetch leaderboard data from the API
  async function fetchLeaderboardData() {
    loadingIndicator.style.display = 'flex';
    errorMessage.style.display = 'none';
    
    try {
      const response = await fetch('/api/leaderboard');
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const rawData = await response.json();
      console.log('Received raw data from API:', rawData); // Debug log
      
      // Handle nested data structure
      const data = rawData.data || rawData;
      console.log('Processed data:', data); // Debug log
      
      loadingIndicator.style.display = 'none';
      
      // Validate and extract miners data
      let miners = [];
      if (data.miners) {
        if (Array.isArray(data.miners)) {
          miners = data.miners;
        } else {
          console.warn('Miners property is not an array:', data.miners);
        }
      } else if (Array.isArray(data)) {
        // Handle case where the response might be just the miners array
        miners = data;
      }
      
      console.log('Extracted miners data:', {
        minersFound: miners.length > 0,
        minersCount: miners.length,
        firstMiner: miners[0]
      });
      
      // Validate totalHashrate
      const totalHashrate = data.totalHashrate || data.networkHashrate || '0';
      
      // If we have no miners data at all, throw error
      if (miners.length === 0) {
        throw new Error('No miners data available');
      }
      
      // Store miners data with network hashrate
      allMiners = miners.map(miner => ({
        ...miner,
        networkTotalHashrate: totalHashrate
      }));
      
      // Update network stats
      updateNetworkStats(totalHashrate, miners.length);
      
      // Update timestamp - check all possible timestamp locations
      const timestamp = rawData.status?.lastUpdate || data.lastUpdated || rawData.status?.timestamp || new Date().toISOString();
      if (timestamp) {
        lastUpdateEl.textContent = new Date(timestamp).toLocaleString();
      }
      
      // Initial filter/render
      filterMiners();
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      console.error('Full error details:', {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      loadingIndicator.style.display = 'none';
      errorMessage.style.display = 'block';
      errorMessage.textContent = 'Failed to load leaderboard data: ' + error.message;
    }
  }
  
  // Initialize event listeners
  function initEventListeners() {
    // Search input
    minerSearchInput.addEventListener('input', filterMiners);
    
    // Clear search button
    clearSearchButton.addEventListener('click', function() {
      minerSearchInput.value = '';
      filterMiners();
    });
    
    // Pagination
    prevPageBtn.addEventListener('click', function() {
      if (currentPage > 1) {
        currentPage--;
        renderMiners();
      }
    });
    
    nextPageBtn.addEventListener('click', function() {
      if ((currentPage * minersPerPage) < filteredMiners.length) {
        currentPage++;
        renderMiners();
      }
    });
    
    // Refresh button
    refreshButton.addEventListener('click', function() {
      fetchLeaderboardData();
    });
  }
  
  // Initialize the app
  function init() {
    initEventListeners();
    fetchLeaderboardData();
    setInterval(fetchLeaderboardData, 60000);
  }
  
  init();
}); 