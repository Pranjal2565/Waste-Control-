// Main Application Logic
let regionsData = [];
let cleaningLog = [];
let selectedRegion = null;

// Initialize the application
async function init() {
    regionsData = await DATA.loadRegions();
    cleaningLog = await DATA.loadCleaningLog();
    
    updateStats();
    renderMapMarkers();
    populateRegionSelects();
    renderCleaningLog();
    setupEventListeners();
}

// Update statistics
function updateStats() {
    const totalFlags = regionsData.reduce((sum, r) => sum + (r.red_flags || 0), 0);
    const activeRegions = regionsData.filter(r => r.red_flags >= 3).length;
    
    document.getElementById('totalFlags').textContent = totalFlags;
    document.getElementById('activeRegions').textContent = activeRegions;
}

// Render map markers
function renderMapMarkers() {
    const markersDiv = document.getElementById('mapMarkers');
    markersDiv.innerHTML = '';
    
    regionsData.forEach(region => {
        if (region.latitude && region.longitude) {
            const marker = document.createElement('div');
            marker.className = 'map-marker';
            marker.style.left = region.longitude + '%';
            marker.style.top = region.latitude + '%';
            marker.textContent = region.red_flags || 0;
            
            // Color coding
            if (region.red_flags >= 4) {
                marker.classList.add('marker-4-plus');
            } else if (region.red_flags === 3) {
                marker.classList.add('marker-3');
            } else {
                marker.classList.add('marker-0-2');
            }
            
            marker.title = `${region.name}: ${region.red_flags} red flags`;
            marker.addEventListener('click', () => showRegionDetails(region));
            
            markersDiv.appendChild(marker);
        }
    });
}

// Handle flag submission
async function handleFlagSubmit(event) {
    event.preventDefault();
    
    const regionName = document.getElementById('regionSelect').value;
    const issueType = document.getElementById('issueType').value;
    const description = document.getElementById('description').value;
    
    // Update local data
    const region = regionsData.find(r => r.name === regionName);
    if (region) {
        region.red_flags++;
        
        // If 3 flags reached, auto-generate cleaning log
        if (region.red_flags === 3) {
            addCleaningLogEntry(region.name);
        }
        
        updateStats();
        renderMapMarkers();
        
        alert(`Red flag raised for ${regionName}!`);
        document.getElementById('flagForm').reset();
    }
}

// Add cleaning log entry
function addCleaningLogEntry(regionName) {
    const entry = {
        region: regionName,
        cleaned_date: new Date().toISOString().split('T')[0],
        cleaned_time: new Date().toLocaleTimeString(),
        issue_type: 'Cleaning Deployed',
        status: 'Completed'
    };
    
    cleaningLog.unshift(entry);
    renderCleaningLog();
}

// Render cleaning log
function renderCleaningLog(filterDate = '', filterRegion = '') {
    const logContainer = document.getElementById('cleaningLog');
    let filteredLog = cleaningLog;
    
    if (filterDate) {
        filteredLog = filteredLog.filter(entry => entry.cleaned_date === filterDate);
    }
    if (filterRegion) {
        filteredLog = filteredLog.filter(entry => entry.region === filterRegion);
    }
    
    if (filteredLog.length === 0) {
        logContainer.innerHTML = '<p>No cleaning records found.</p>';
        return;
    }
    
    logContainer.innerHTML = filteredLog.map(entry => `
        <div class="log-entry">
            <div class="region">📍 ${entry.region}</div>
            <div class="date">📅 ${entry.cleaned_date} at ${entry.cleaned_time}</div>
            <div>Status: ${entry.status}</div>
        </div>
    `).join('');
}

// Show region details in modal
function showRegionDetails(region) {
    const modal = document.getElementById('regionModal');
    document.getElementById('modalTitle').textContent = region.name;
    document.getElementById('modalContent').innerHTML = `
        <p><strong>Red Flags:</strong> ${region.red_flags}</p>
        <p><strong>Status:</strong> ${region.red_flags >= 3 ? '🔴 Action Required' : '🟢 Under Control'}</p>
        <p><strong>Last Cleaned:</strong> ${region.last_cleaned || 'N/A'}</p>
        <button onclick="addCleaningLogEntry('${region.name}')">Deploy Cleaning Service</button>
    `;
    modal.style.display = 'block';
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('flagForm').addEventListener('submit', handleFlagSubmit);
    
    // Close modal
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('regionModal').style.display = 'none';
    });
    
    // Filter cleaning log
    document.getElementById('logDateFilter').addEventListener('change', (e) => {
        const regionFilter = document.getElementById('logRegionFilter').value;
        renderCleaningLog(e.target.value, regionFilter);
    });
    
    document.getElementById('logRegionFilter').addEventListener('change', (e) => {
        const dateFilter = document.getElementById('logDateFilter').value;
        renderCleaningLog(dateFilter, e.target.value);
    });
}

// Populate region dropdowns
function populateRegionSelects() {
    const regionSelect = document.getElementById('regionSelect');
    const logRegionFilter = document.getElementById('logRegionFilter');
    
    const options = regionsData.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    regionSelect.innerHTML += options;
    logRegionFilter.innerHTML += options;
}

// Start the application
window.addEventListener('DOMContentLoaded', init);