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
    return {
      abscanLink: `https://abscan.org/address/${address}`,
      gameRoomLink: `https://www.bigcoin.tech/room/${address}`,
      abstractProfileLink: `https://portal.abs.xyz/profile/${address}`
    };
  }
  
  // Function to calculate percentage of network
  function calculatePercentage(hashrate, totalHashrate) {
    if (!totalHashrate || totalHashrate === '0') return '0%';
    
    try {
      // Convert to numbers and handle string inputs
      const minerHashrate = Number(hashrate);
      const networkHashrate = Number(totalHashrate);
      
      if (networkHashrate === 0) return '0%';
      
      // Calculate percentage with 6 decimal places precision
      const percentage = (minerHashrate / networkHashrate) * 100;
      
      // Format based on size
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
    if (displayedMinersCount) displayedMinersCount.textContent = filteredMiners.length;
    if (totalMinersCount) totalMinersCount.textContent = allMiners.length;
    
    // Reset to first page when filtering
    currentPage = 1;
    
    // Render the filtered miners
    renderMiners();
  }
  
  // Function to render the current page of miners
  function renderMiners() {
    if (!minerTableBody) return;
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * minersPerPage;
    const endIndex = Math.min(startIndex + minersPerPage, filteredMiners.length);
    const currentMiners = filteredMiners.slice(startIndex, endIndex);
    
    // Update pagination info
    if (paginationInfo) {
      paginationInfo.textContent = `Page ${currentPage} of ${Math.ceil(filteredMiners.length / minersPerPage)}`;
    }
    
    // Enable/disable pagination buttons
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = endIndex >= filteredMiners.length;
    
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
    
    // Add miners to the table
    currentMiners.forEach((miner, index) => {
      const row = document.createElement('tr');
      const globalRank = startIndex + index + 1;
      const links = generateLinks(miner.address);
      
      row.innerHTML = `
        <td>${globalRank}</td>
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
        <td>${formatHashrate(miner.hashrate)}</td>
        <td>${calculatePercentage(miner.hashrate, miner.networkTotalHashrate)}</td>
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
  
  async function fetchLeaderboardData() {
    try {
      showLoading(true);
      showError('', false);
      
      console.log('Fetching leaderboard data...');
      const response = await fetch('/static/leaderboard.json');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received leaderboard data:', data);
      
      if (!data || !data.miners) {
        throw new Error('Invalid data format received');
      }
      
      // Store miners with network total hashrate
      allMiners = data.miners.map(miner => ({
        ...miner,
        networkTotalHashrate: data.totalHashrate || "0"
      }));
      
      // Sort miners by hashrate in descending order
      allMiners.sort((a, b) => Number(b.hashrate) - Number(a.hashrate));
      
      // Initialize filtered miners
      filteredMiners = [...allMiners];
      
      // Update UI elements
      if (totalNetworkHashrate) totalNetworkHashrate.textContent = formatHashrate(data.totalHashrate);
      if (totalMinersCount) totalMinersCount.textContent = allMiners.length;
      if (displayedMinersCount) displayedMinersCount.textContent = allMiners.length;
      if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleString();
      
      // Render miners table
      renderMiners();
      
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      showError(`Failed to load leaderboard data: ${error.message}`);
    } finally {
      showLoading(false);
    }
  }
  
  // Helper functions for UI state management
  function showLoading(show = true) {
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'flex' : 'none';
    }
  }
  
  function showError(message = '', show = true) {
    if (errorMessage) {
      errorMessage.style.display = show ? 'block' : 'none';
      if (show) {
        errorMessage.textContent = message;
      }
    }
  }
  
  // Initialize event listeners
  function initEventListeners() {
    if (minerSearchInput) {
      minerSearchInput.addEventListener('input', filterMiners);
    }
    
    if (clearSearchButton) {
      clearSearchButton.addEventListener('click', function() {
        if (minerSearchInput) {
          minerSearchInput.value = '';
          filterMiners();
        }
      });
    }
    
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', function() {
        if (currentPage > 1) {
          currentPage--;
          renderMiners();
        }
      });
    }
    
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', function() {
        if ((currentPage * minersPerPage) < filteredMiners.length) {
          currentPage++;
          renderMiners();
        }
      });
    }
    
    if (refreshButton) {
      refreshButton.addEventListener('click', fetchLeaderboardData);
    }
  }
  
  // Initialize the app
  function init() {
    initEventListeners();
    fetchLeaderboardData();
    // Refresh every 5 minutes
    setInterval(fetchLeaderboardData, 5 * 60 * 1000);
  }
  
  init();
}); 