const blockchainService = require('./services/blockchain');
const fs = require('fs').promises;
const path = require('path');

async function waitForBlockchainConnection(maxAttempts = 5) {
    // First ensure blockchain service is initialized
    await blockchainService.initialize();
    
    let attempts = 0;
    while (attempts < maxAttempts) {
        if (blockchainService.isConnectedToBlockchain) {
            console.log('Successfully connected to blockchain');
            return true;
        }
        console.log(`Waiting for blockchain connection... (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        attempts++;
    }
    
    return false;
}

async function generateStaticData() {
    console.log('Generating static leaderboard data...');
    
    try {
        // Wait for blockchain connection
        const isConnected = await waitForBlockchainConnection();
        if (!isConnected) {
            throw new Error('Failed to connect to blockchain after multiple attempts');
        }

        // Force a new update of the leaderboard
        console.log('Forcing a fresh leaderboard update...');
        const result = await blockchainService.updateLeaderboard(true);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to update leaderboard');
        }

        const data = result.data;
        
        // Add timestamp and metadata
        const staticData = {
            ...data,
            generatedAt: new Date().toISOString(),
            nextUpdateAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
            metadata: {
                totalMiners: data.miners?.length || 0,
                lastScannedBlock: data.lastScannedBlock,
                isPartialUpdate: data.isPartialUpdate || false
            }
        };

        // Ensure the static directory exists
        const staticDir = path.join(__dirname, '..', 'frontend', 'static');
        await fs.mkdir(staticDir, { recursive: true });

        // Write the current data
        const currentDataPath = path.join(staticDir, 'leaderboard.json');
        await fs.writeFile(currentDataPath, JSON.stringify(staticData, null, 2));

        // Also save a timestamped version for history
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const historyPath = path.join(staticDir, `leaderboard-${timestamp}.json`);
        await fs.writeFile(historyPath, JSON.stringify(staticData, null, 2));

        console.log('Static data generated successfully');
        console.log(`Files saved:\n- ${currentDataPath}\n- ${historyPath}`);
        
        return true;
    } catch (error) {
        console.error('Error generating static data:', error);
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    generateStaticData().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { generateStaticData }; 