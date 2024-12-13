// Create a Web Worker for CORS requests
const workerBlob = new Blob([`
  self.addEventListener('message', async (e) => {
    const { url, options } = e.data;
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      self.postMessage({ success: true, data });
    } catch (error) {
      self.postMessage({ success: false, error: error.message });
    }
  });
`], { type: 'application/javascript' });

const workerUrl = URL.createObjectURL(workerBlob);
const worker = new Worker(workerUrl);

// Function to make CORS requests
function makeCorsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
            if (e.data.success) {
                resolve(e.data.data);
            } else {
                reject(new Error(e.data.error));
            }
        };
        worker.postMessage({ url, options });
    });
}

// Function to format numbers with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Function to extract Steam data from HTML string
function extractSteamData(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    let stats = {
        itemsOwned: '...',
        tradesMade: '...',
        marketTransactions: '...'
    };

    try {
        // Find the showcase stats row
        const statsRow = doc.querySelector('.showcase_stats_trading');
        if (statsRow) {
            const statValues = statsRow.querySelectorAll('.showcase_stat .value');
            if (statValues.length >= 3) {
                stats = {
                    itemsOwned: statValues[0].textContent.trim(),
                    tradesMade: statValues[1].textContent.trim(),
                    marketTransactions: statValues[2].textContent.trim()
                };
            }
        }
    } catch (error) {
        console.error('Error parsing Steam stats:', error);
    }

    return { stats };
}

// Function to update all stats display
function updateDisplay(steamData, csgoRepData) {
    // Update Steam stats
    if (steamData && steamData.stats) {
        document.getElementById('items-owned').textContent = formatNumber(steamData.stats.itemsOwned);
        document.getElementById('trades-made').textContent = formatNumber(steamData.stats.tradesMade);
        document.getElementById('market-transactions').textContent = formatNumber(steamData.stats.marketTransactions);
    }

    // Update CSGORep stats
    if (csgoRepData && csgoRepData.profile && csgoRepData.profile.feedback) {
        const feedback = csgoRepData.profile.feedback;
        document.getElementById('feedback-positive').textContent = formatNumber(feedback.positive || 0);
        document.getElementById('feedback-neutral').textContent = formatNumber(feedback.neutral || 0);
        document.getElementById('csrep-crypto').textContent = formatNumber(feedback.crypto || 0);
        document.getElementById('csrep-balance').textContent = formatNumber(feedback.balance || 0);
        document.getElementById('csrep-cash').textContent = formatNumber(feedback.cash || 0);
    }

    // Update showcase notes with enhanced styling
    if (steamData && steamData.notes) {
        const showcaseContent = document.getElementById('showcase-content');
        showcaseContent.innerHTML = steamData.notes
            .filter(note => note.trim()) // Remove empty notes
            .map(note => `
                <div class="showcase-note">
                    ${note.trim()}
                </div>
            `).join('');
    }
}

// Function to fetch Steam profile data
async function fetchSteamData() {
    try {
        const corsProxy = 'https://corsproxy.io/?';
        const steamUrl = 'https://steamcommunity.com/id/vancho666/';
        
        const response = await fetch(corsProxy + encodeURIComponent(steamUrl));
        if (!response.ok) throw new Error('Failed to fetch Steam data');

        const html = await response.text();
        return extractSteamData(html);
    } catch (error) {
        console.error('Error fetching Steam data:', error);
        
        // Try to use cached data
        const cached = localStorage.getItem('steamData');
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 3600000) {
                return data;
            }
        }
        
        return null;
    }
}

// Function to fetch CSGORep data
async function fetchCSRepData() {
    try {
        const jsonData = await makeCorsRequest('https://api.csgo-rep.com/', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "*/*",
            },
            body: JSON.stringify({
                id: "206",
                query: {
                    steam_id: "76561198116040991"
                }
            })
        });

        // Cache the CSGORep data
        localStorage.setItem('csrepData', JSON.stringify({
            data: jsonData,
            timestamp: Date.now()
        }));

        return jsonData;
    } catch (error) {
        console.error('Error fetching CSRep data:', error);
        
        // Try to use cached data
        const cached = localStorage.getItem('csrepData');
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 3600000) {
                return data;
            }
        }
        
        return null;
    }
}

// Initialize with loading state
document.querySelectorAll('.stat-value').forEach(el => {
    el.textContent = '...';
});

// Function to update all data
async function updateAllData() {
    const [steamData, csgoRepData] = await Promise.all([
        fetchSteamData(),
        fetchCSRepData()
    ]);
    
    updateDisplay(steamData, csgoRepData);
}

// Try to show cached data immediately
const cachedSteam = localStorage.getItem('steamData');
const cachedCSGORep = localStorage.getItem('csrepData');
if (cachedSteam && cachedCSGORep) {
    const steamData = JSON.parse(cachedSteam).data;
    const csgoRepData = JSON.parse(cachedCSGORep).data;
    updateDisplay(steamData, csgoRepData);
}

// Fetch fresh data
updateAllData();

// Update every 5 minutes
setInterval(updateAllData, 300000); 