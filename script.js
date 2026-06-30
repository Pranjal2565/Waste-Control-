/* ============================================================
   script.js - Haryana Waste Management Control
   Complete JavaScript with Data Management, Map, Form, Modal
   ============================================================ */

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    CSV_PATH: {
        regions: 'data/regions.csv',
        cleaningLog: 'data/cleaning-log.csv'
    },
    REFRESH_INTERVAL: 60000, // 60 seconds
    ACTIVITY_REFRESH: 30000, // 30 seconds
    TOAST_DURATION: 4000,
    MAX_TOASTS: 3,
    CRITICAL_THRESHOLD: 3,
    MAP_WIDTH: 800,
    MAP_HEIGHT: 600
};

// ============================================================
// STATE
// ============================================================
const state = {
    regions: [],
    cleaningLog: [],
    activityFeed: [],
    selectedRegion: null,
    selectedIssue: null,
    currentStep: 1,
    darkMode: false,
    heatMap: false,
    toastQueue: [],
    loading: false,
    modalOpen: false,
    logPage: 0,
    logLimit: 10
};

// ============================================================
// DOM REFS
// ============================================================
const DOM = {
    // Header
    totalFlags: document.getElementById('totalFlags'),
    activeRegions: document.getElementById('activeRegions'),
    areasCleaned: document.getElementById('areasCleaned'),
    lastUpdated: document.getElementById('lastUpdated'),
    notifBadge: document.getElementById('notifBadge'),
    themeToggle: document.getElementById('themeToggle'),
    
    // Map
    mapContainer: document.getElementById('mapContainer'),
    markerOverlay: document.getElementById('markerOverlay'),
    heatToggle: document.getElementById('heatToggle'),
    truckIcon: document.getElementById('truckIcon'),
    
    // Form
    reportForm: document.getElementById('reportForm'),
    regionSelect: document.getElementById('regionSelect'),
    issueDesc: document.getElementById('issueDesc'),
    urgencySelect: document.getElementById('urgencySelect'),
    uploadZone: document.getElementById('uploadZone'),
    imageUpload: document.getElementById('imageUpload'),
    submitBtn: document.getElementById('submitBtn'),
    formSuccess: document.getElementById('formSuccess'),
    stepIndicators: document.querySelectorAll('.step'),
    formSteps: document.querySelectorAll('.form-step'),
    issueCards: document.querySelectorAll('.issue-card'),
    
    // Activity Feed
    activityFeed: document.getElementById('activityFeed'),
    
    // Cleaning Log
    filterDate: document.getElementById('filterDate'),
    filterRegion: document.getElementById('filterRegion'),
    filterStatus: document.getElementById('filterStatus'),
    logTimeline: document.getElementById('logTimeline'),
    loadMoreBtn: document.getElementById('loadMoreLog'),
    
    // Modal
    regionModal: document.getElementById('regionModal'),
    modalClose: document.getElementById('modalClose'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalTitle: document.getElementById('modalTitle'),
    modalStatus: document.getElementById('modalStatus'),
    modalFlags: document.getElementById('modalFlags'),
    modalLastCleaned: document.getElementById('modalLastCleaned'),
    modalScore: document.getElementById('modalScore'),
    modalTimeline: document.getElementById('modalTimeline'),
    modalDeploy: document.getElementById('modalDeploy'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer'),
    
    // Footer
    year: document.getElementById('year')
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Format date in Indian format
function formatIndianDate(dateString) {
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format time in Indian format
function formatIndianTime(dateString) {
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Get relative time (moment.js style)
function timeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diff = Math.floor((now - past) / 1000);
    
    if (diff < 5) return 'just now';
    if (diff < 60) return diff + ' seconds ago';
    if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 604800) return Math.floor(diff / 86400) + ' days ago';
    return formatIndianDate(dateString);
}

// Debounce
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Throttle
function throttle(fn, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// LocalStorage helpers
function saveToStorage(key, data) {
    try {
        localStorage.setItem('haryana_wm_' + key, JSON.stringify(data));
    } catch (e) {
        console.warn('Storage save failed:', e);
    }
}

function loadFromStorage(key) {
    try {
        const data = localStorage.getItem('haryana_wm_' + key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn('Storage load failed:', e);
        return null;
    }
}

// CSV Export
function exportCSV(data, filename) {
    if (!data || !data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

// ============================================================
// DATA MANAGEMENT
// ============================================================

async function loadCSV(file) {
    try {
        const response = await fetch(file);
        const text = await response.text();
        return new Promise((resolve) => {
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                trimHeaders: true,
                complete: (result) => resolve(result.data),
                error: (err) => {
                    console.error('CSV parse error:', err);
                    resolve([]);
                }
            });
        });
    } catch (e) {
        console.error('Load CSV error:', e);
        return [];
    }
}

async function loadAllData() {
    try {
        // Load regions
        let regions = await loadCSV(CONFIG.CSV_PATH.regions);
        if (regions.length === 0) {
            // Fallback data
            regions = getFallbackRegions();
        }
        state.regions = regions.map(r => ({
            ...r,
            red_flags: parseInt(r.red_flags) || 0,
            cleanliness_score: parseInt(r.cleanliness_score) || 50,
            latitude: parseFloat(r.latitude) || 29,
            longitude: parseFloat(r.longitude) || 76
        }));
        
        // Load cleaning log
        let log = await loadCSV(CONFIG.CSV_PATH.cleaningLog);
        if (log.length === 0) {
            log = getFallbackLog();
        }
        state.cleaningLog = log.map(entry => ({
            ...entry,
            cleaned_date: entry.cleaned_date || new Date().toISOString().slice(0, 10)
        }));
        
        // Sort log by date (newest first)
        state.cleaningLog.sort((a, b) => {
            return new Date(b.cleaned_date + ' ' + (b.cleaned_time || '00:00')) - 
                   new Date(a.cleaned_date + ' ' + (a.cleaned_time || '00:00'));
        });
        
        // Save to localStorage as backup
        saveToStorage('regions', state.regions);
        saveToStorage('cleaningLog', state.cleaningLog);
        
        return true;
    } catch (e) {
        console.error('Data load error:', e);
        // Try loading from localStorage
        const cachedRegions = loadFromStorage('regions');
        const cachedLog = loadFromStorage('cleaningLog');
        if (cachedRegions) state.regions = cachedRegions;
        if (cachedLog) state.cleaningLog = cachedLog;
        return cachedRegions !== null;
    }
}

function getFallbackRegions() {
    const districts = [
        { name: 'Panchkula', lat: 30.69, lng: 76.86, flags: 3 },
        { name: 'Ambala', lat: 30.38, lng: 76.78, flags: 1 },
        { name: 'Yamunanagar', lat: 30.10, lng: 77.28, flags: 2 },
        { name: 'Kurukshetra', lat: 30.00, lng: 76.50, flags: 0 },
        { name: 'Karnal', lat: 29.69, lng: 76.98, flags: 2 },
        { name: 'Panipat', lat: 29.39, lng: 76.97, flags: 1 },
        { name: 'Sonipat', lat: 28.99, lng: 77.01, flags: 0 },
        { name: 'Rohtak', lat: 28.89, lng: 76.59, flags: 4 },
        { name: 'Jhajjar', lat: 28.61, lng: 76.66, flags: 2 },
        { name: 'Faridabad', lat: 28.41, lng: 77.30, flags: 3 },
        { name: 'Gurugram', lat: 28.46, lng: 77.03, flags: 1 },
        { name: 'Mahendragarh', lat: 28.27, lng: 76.15, flags: 0 },
        { name: 'Rewari', lat: 28.20, lng: 76.62, flags: 2 },
        { name: 'Bhiwani', lat: 28.79, lng: 76.14, flags: 1 },
        { name: 'Hisar', lat: 29.15, lng: 75.72, flags: 3 },
        { name: 'Fatehabad', lat: 29.52, lng: 75.45, flags: 0 },
        { name: 'Sirsa', lat: 29.54, lng: 75.03, flags: 2 },
        { name: 'Jind', lat: 29.32, lng: 76.31, flags: 1 },
        { name: 'Kaithal', lat: 29.80, lng: 76.40, flags: 0 },
        { name: 'Nuh', lat: 28.10, lng: 77.02, flags: 2 },
        { name: 'Palwal', lat: 28.14, lng: 77.33, flags: 1 },
        { name: 'Charkhi Dadri', lat: 28.60, lng: 76.27, flags: 0 }
    ];
    return districts.map(d => ({
        name: d.name,
        latitude: d.lat,
        longitude: d.lng,
        red_flags: d.flags,
        last_cleaned: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString().slice(0, 10),
        cleanliness_score: Math.max(0, 100 - d.flags * 15 + Math.floor(Math.random() * 10))
    }));
}

function getFallbackLog() {
    const regions = ['Panchkula', 'Ambala', 'Karnal', 'Rohtak', 'Faridabad', 'Hisar', 'Gurugram'];
    const statuses = ['Completed', 'In Progress', 'Scheduled'];
    const issues = ['Garbage Pile-up', 'Stagnant Water', 'Mixed Waste', 'Medical Waste'];
    const teams = ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];
    const remarks = [
        'Area fully sanitized', 'Partial cleanup completed', 'Scheduled for tomorrow',
        'Garbage pile cleared', 'Water drained and treated', 'Community involved'
    ];
    const entries = [];
    for (let i = 0; i < 15; i++) {
        const date = new Date(Date.now() - Math.random() * 10 * 86400000);
        entries.push({
            region: regions[Math.floor(Math.random() * regions.length)],
            cleaned_date: date.toISOString().slice(0, 10),
            cleaned_time: new Date(date.getTime() + Math.random() * 43200000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            issue_type: issues[Math.floor(Math.random() * issues.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            team_deployed: teams[Math.floor(Math.random() * teams.length)],
            remarks: remarks[Math.floor(Math.random() * remarks.length)]
        });
    }
    return entries;
}

// ============================================================
// MAP RENDERING
// ============================================================

function renderMarkers() {
    const overlay = DOM.markerOverlay;
    overlay.innerHTML = '';
    
    state.regions.forEach(region => {
        const flags = region.red_flags || 0;
        const x = ((region.longitude - 74.5) / 3.0) * 100;
        const y = ((31.0 - region.latitude) / 3.5) * 100;
        
        const marker = document.createElement('div');
        marker.className = 'marker';
        marker.style.left = x + '%';
        marker.style.top = y + '%';
        marker.dataset.region = region.name;
        
        let colorClass = 'green';
        if (flags >= 4) colorClass = 'red';
        else if (flags >= 3) colorClass = 'orange';
        
        const dot = document.createElement('div');
        dot.className = `marker-dot ${colorClass}`;
        dot.textContent = flags;
        
        // Radar rings for critical
        if (flags >= 3) {
            for (let i = 0; i < 3; i++) {
                const ring = document.createElement('div');
                ring.className = 'radar-ring';
                ring.style.animationDelay = (i * 0.6) + 's';
                dot.appendChild(ring);
            }
        }
        
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'marker-tooltip';
        tooltip.textContent = `${region.name}: ${flags} flags`;
        
        marker.appendChild(dot);
        marker.appendChild(tooltip);
        
        // Click handler
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            openRegionModal(region.name);
            // Ripple effect
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(5,150,105,0.3);
                width: 40px;
                height: 40px;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%) scale(0.4);
                animation: ripple 0.6s ease-out forwards;
                pointer-events: none;
            `;
            marker.appendChild(ripple);
            setTimeout(() => ripple.remove(), 700);
        });
        
        overlay.appendChild(marker);
    });
    
    updateLastUpdated();
}

function updateLastUpdated() {
    DOM.lastUpdated.textContent = 'Updated: ' + new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ============================================================
// STATISTICS
// ============================================================

function updateStats() {
    const total = state.regions.reduce((sum, r) => sum + (r.red_flags || 0), 0);
    const active = state.regions.filter(r => (r.red_flags || 0) >= 3).length;
    const today = new Date().toISOString().slice(0, 10);
    const cleaned = state.cleaningLog.filter(e => 
        e.cleaned_date === today && e.status === 'Completed'
    ).length;
    
    animateNumber(DOM.totalFlags, total);
    animateNumber(DOM.activeRegions, active);
    animateNumber(DOM.areasCleaned, cleaned);
    
    // Update notification badge
    const critical = state.regions.filter(r => (r.red_flags || 0) >= 4).length;
    DOM.notifBadge.textContent = critical || '0';
    DOM.notifBadge.style.display = critical ? 'flex' : 'none';
}

function animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();
    const diff = target - current;
    
    function update(time) {
        const progress = Math.min((time - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = Math.round(current + diff * eased);
        el.textContent = val;
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = target;
        }
    }
    requestAnimationFrame(update);
}

// ============================================================
// ACTIVITY FEED
// ============================================================

function updateActivityFeed() {
    const feed = DOM.activityFeed;
    // Generate synthetic activities
    const actions = [];
    const regions = state.regions;
    const now = new Date();
    
    // Add some flag events
    for (let i = 0; i < 3; i++) {
        const region = regions[Math.floor(Math.random() * regions.length)];
        const minutes = Math.floor(Math.random() * 60);
        const date = new Date(now - minutes * 60000);
        actions.push({
            type: 'flag',
            region: region.name,
            time: date.toISOString(),
            message: `🚩 Flag raised in ${region.name}`
        });
    }
    
    // Add some clean events
    for (let i = 0; i < 2; i++) {
        const region = regions[Math.floor(Math.random() * regions.length)];
        const minutes = Math.floor(Math.random() * 120);
        const date = new Date(now - minutes * 60000);
        actions.push({
            type: 'clean',
            region: region.name,
            time: date.toISOString(),
            message: `✅ ${region.name} cleaned`
        });
    }
    
    // Sort by time (newest first)
    actions.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    // Render
    feed.innerHTML = actions.map(action => `
        <div class="feed-item ${action.type}">
            <span>${action.message}</span>
            <span class="feed-time">${timeAgo(action.time)}</span>
        </div>
    `).join('');
}

// ============================================================
// CLEANING LOG
// ============================================================

function renderCleaningLog(resetPage = true) {
    if (resetPage) state.logPage = 0;
    
    const filtered = filterLogEntries();
    const start = state.logPage * state.logLimit;
    const pageItems = filtered.slice(start, start + state.logLimit);
    
    if (pageItems.length === 0 && state.logPage === 0) {
        DOM.logTimeline.innerHTML = `<div class="empty-state">🧹 No cleaning records found</div>`;
        DOM.loadMoreBtn.style.display = 'none';
        return;
    }
    
    const html = pageItems.map(entry => {
        let statusClass = 'status-completed';
        let statusIcon = '✅';
        if (entry.status === 'In Progress') {
            statusClass = 'status-progress';
            statusIcon = '🔄';
        } else if (entry.status === 'Scheduled') {
            statusClass = 'status-scheduled';
            statusIcon = '📋';
        }
        
        return `
            <div class="log-entry ${statusClass}">
                <div class="log-header">
                    <span><strong>${entry.region}</strong> ${statusIcon} ${entry.status}</span>
                    <span style="font-size:0.75rem;color:#64748b;">${formatIndianDate(entry.cleaned_date)} ${entry.cleaned_time || ''}</span>
                </div>
                <div class="log-details">
                    ${entry.issue_type} · ${entry.team_deployed || 'N/A'}
                    <button class="expand-btn" data-id="${entry.id || generateId()}">View Details</button>
                </div>
                <div class="expanded-content" data-id="${entry.id || generateId()}">
                    <strong>Remarks:</strong> ${entry.remarks || 'No remarks'}
                </div>
            </div>
        `;
    }).join('');
    
    DOM.logTimeline.innerHTML = html;
    
    // Add expand handlers
    document.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.id;
            const content = document.querySelector(`.expanded-content[data-id="${id}"]`);
            if (content) {
                content.classList.toggle('open');
                this.textContent = content.classList.contains('open') ? 'Hide Details' : 'View Details';
            }
        });
    });
    
    // Show/hide load more
    const hasMore = filtered.length > (state.logPage + 1) * state.logLimit;
    DOM.loadMoreBtn.style.display = hasMore ? 'block' : 'none';
}

function filterLogEntries() {
    const date = DOM.filterDate.value;
    const region = DOM.filterRegion.value;
    const status = DOM.filterStatus.value;
    
    return state.cleaningLog.filter(entry => {
        if (date && entry.cleaned_date !== date) return false;
        if (region && entry.region !== region) return false;
        if (status && entry.status !== status) return false;
        return true;
    });
}

// ============================================================
// FORM HANDLING
// ============================================================

function initForm() {
    // Populate region dropdown
    populateRegionSelect();
    
    // Step navigation
    document.querySelectorAll('.step-next').forEach(btn => {
        btn.addEventListener('click', () => goToStep(state.currentStep + 1));
    });
    document.querySelectorAll('.step-prev').forEach(btn => {
        btn.addEventListener('click', () => goToStep(state.currentStep - 1));
    });
    
    // Issue card selection
    DOM.issueCards.forEach(card => {
        card.addEventListener('click', function() {
            DOM.issueCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            state.selectedIssue = this.dataset.issue;
        });
    });
    
    // Upload zone
    DOM.uploadZone.addEventListener('click', () => DOM.imageUpload.click());
    DOM.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.uploadZone.classList.add('dragover');
    });
    DOM.uploadZone.addEventListener('dragleave', () => {
        DOM.uploadZone.classList.remove('dragover');
    });
    DOM.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    DOM.imageUpload.addEventListener('change', function() {
        if (this.files.length) handleFile(this.files[0]);
    });
    
    // Form submission
    DOM.reportForm.addEventListener('submit', handleFormSubmit);
}

function populateRegionSelect() {
    const select = DOM.regionSelect;
    select.innerHTML = '<option value="">— Choose —</option>';
    state.regions.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.name;
        opt.textContent = `${r.name} (${r.red_flags || 0} flags)`;
        select.appendChild(opt);
    });
    
    // Also populate filter region
    const filterSelect = DOM.filterRegion;
    filterSelect.innerHTML = '<option value="">All Regions</option>';
    state.regions.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.name;
        opt.textContent = r.name;
        filterSelect.appendChild(opt);
    });
}

function goToStep(step) {
    if (step < 1 || step > 3) return;
    state.currentStep = step;
    
    // Validate step 1
    if (step === 2 && !DOM.regionSelect.value) {
        showToast('Please select a district first', 'warning');
        return;
    }
    if (step === 3 && !state.selectedIssue) {
        showToast('Please select an issue type', 'warning');
        return;
    }
    
    DOM.formSteps.forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.step) === step);
    });
    DOM.stepIndicators.forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.toggle('active', s === step);
        el.classList.toggle('completed', s < step);
    });
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        DOM.uploadZone.innerHTML = `
            <img src="${e.target.result}" style="max-height:80px;border-radius:8px;max-width:100%;" />
            <br><small>Click to change</small>
        `;
    };
    reader.readAsDataURL(file);
    DOM.uploadZone.dataset.hasImage = 'true';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (state.loading) return;
    
    // Validate
    const region = DOM.regionSelect.value;
    if (!region) {
        showToast('Please select a district', 'warning');
        goToStep(1);
        return;
    }
    if (!state.selectedIssue) {
        showToast('Please select an issue type', 'warning');
        goToStep(2);
        return;
    }
    if (!DOM.issueDesc.value.trim()) {
        showToast('Please provide a description', 'warning');
        return;
    }
    
    state.loading = true;
    DOM.submitBtn.disabled = true;
    DOM.submitBtn.innerHTML = '<span class="spinner"></span> Raising...';
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Update region flags
    const regionData = state.regions.find(r => r.name === region);
    if (regionData) {
        regionData.red_flags = (regionData.red_flags || 0) + 1;
        // Update cleanliness score
        regionData.cleanliness_score = Math.max(0, 100 - regionData.red_flags * 12);
        regionData.last_cleaned = regionData.last_cleaned || new Date().toISOString().slice(0, 10);
        
        // Auto-deploy if flags reach 3
        if (regionData.red_flags >= 3) {
            autoDeployCleaning(region);
        }
    }
    
    // Add to activity feed
    addActivity({
        type: 'flag',
        region: region,
        message: `🚩 Flag raised in ${region}`,
        time: new Date().toISOString()
    });
    
    // Save to storage
    saveToStorage('regions', state.regions);
    
    // Show success
    state.loading = false;
    DOM.submitBtn.disabled = false;
    DOM.submitBtn.innerHTML = '🚩 Raise Red Flag';
    DOM.formSuccess.classList.remove('hidden');
    
    // Confetti effect
    triggerConfetti();
    
    showToast(`✅ Flag raised in ${region}!`, 'success');
    
    // Reset form after delay
    setTimeout(() => {
        DOM.formSuccess.classList.add('hidden');
        DOM.reportForm.reset();
        state.selectedIssue = null;
        DOM.issueCards.forEach(c => c.classList.remove('selected'));
        DOM.uploadZone.innerHTML = '📸 Drop image or click to upload';
        delete DOM.uploadZone.dataset.hasImage;
        goToStep(1);
        renderMarkers();
        updateStats();
        updateActivityFeed();
        populateRegionSelect();
    }, 2000);
}

function autoDeployCleaning(region) {
    const entry = {
        id: generateId(),
        region: region,
        cleaned_date: new Date().toISOString().slice(0, 10),
        cleaned_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        issue_type: 'Auto-deployed',
        status: 'In Progress',
        team_deployed: 'Emergency Team',
        remarks: `Auto-deployed due to ${(state.regions.find(r => r.name === region)?.red_flags || 0)} flags`
    };
    state.cleaningLog.unshift(entry);
    saveToStorage('cleaningLog', state.cleaningLog);
    
    showToast(`🧹 Cleaning team deployed to ${region}`, 'info');
    addActivity({
        type: 'clean',
        region: region,
        message: `🧹 Cleaning deployed to ${region}`,
        time: new Date().toISOString()
    });
}

function addActivity(activity) {
    // Add to feed (prepend)
    const feed = DOM.activityFeed;
    const item = document.createElement('div');
    item.className = `feed-item ${activity.type}`;
    item.innerHTML = `
        <span>${activity.message}</span>
        <span class="feed-time">just now</span>
    `;
    feed.prepend(item);
    
    // Limit items
    while (feed.children.length > 20) {
        feed.removeChild(feed.lastChild);
    }
}

function triggerConfetti() {
    const colors = ['#059669', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
    const container = document.body;
    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        const size = 6 + Math.random() * 8;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const duration = 0.8 + Math.random() * 0.6;
        confetti.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            left: ${left}%;
            top: 100%;
            pointer-events: none;
            z-index: 9999;
            animation: confetti ${duration}s ease-out ${delay}s forwards;
            transform-origin: center;
        `;
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 2000);
    }
}

// ============================================================
// REGION DETAIL MODAL
// ============================================================

function openRegionModal(regionName) {
    const region = state.regions.find(r => r.name === regionName);
    if (!region) return;
    
    state.modalOpen = true;
    DOM.regionModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    DOM.modalTitle.textContent = region.name;
    const flags = region.red_flags || 0;
    let status = '✅ Safe';
    let statusColor = '#10B981';
    if (flags >= 4) { status = '🔴 Critical'; statusColor = '#EF4444'; }
    else if (flags >= 3) { status = '🟠 Warning'; statusColor = '#F59E0B'; }
    DOM.modalStatus.textContent = status;
    DOM.modalStatus.style.background = statusColor;
    
    DOM.modalFlags.textContent = flags;
    DOM.modalLastCleaned.textContent = region.last_cleaned || 'Never';
    DOM.modalScore.textContent = region.cleanliness_score || 50;
    
    // Show recent flags timeline
    const recentFlags = state.cleaningLog
        .filter(e => e.region === regionName)
        .slice(0, 5);
    DOM.modalTimeline.innerHTML = recentFlags.length ? 
        recentFlags.map(e => `
            <div style="padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.05);font-size:0.85rem;">
                ${e.status === 'Completed' ? '✅' : '🔄'} ${e.issue_type || 'Cleaning'} 
                <span style="float:right;color:#64748b;font-size:0.75rem;">${formatIndianDate(e.cleaned_date)}</span>
            </div>
        `).join('') :
        '<div style="color:#94a3b8;font-size:0.85rem;">No recent activity</div>';
}

function closeRegionModal() {
    state.modalOpen = false;
    DOM.regionModal.classList.remove('open');
    document.body.style.overflow = '';
}

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================

function showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    const colors = {
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };
    
    // Queue management
    const container = DOM.toastContainer;
    if (container.children.length >= CONFIG.MAX_TOASTS) {
        container.firstChild?.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        margin-bottom: 10px;
        background: rgba(255,255,255,0.92);
        backdrop-filter: blur(16px);
        border-radius: 14px;
        border-left: 4px solid ${colors[type]};
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        animation: slideInRight 0.4s ease forwards;
        min-width: 280px;
        max-width: 400px;
        position: relative;
        font-size: 0.9rem;
        font-weight: 500;
    `;
    
    toast.innerHTML = `
        <span style="font-size:22px;">${icons[type] || 'ℹ️'}</span>
        <span style="flex:1;">${message}</span>
        <button class="toast-close" style="background:none;border:none;font-size:18px;cursor:pointer;color:#94a3b8;padding:0 4px;">✕</button>
        <div style="position:absolute;bottom:0;left:0;height:3px;background:${colors[type]};border-radius:0 2px 0 0;width:100%;animation: progressBar ${duration}ms linear forwards;"></div>
    `;
    
    container.appendChild(toast);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        dismissToast(toast);
    });
    
    // Auto dismiss
    setTimeout(() => {
        dismissToast(toast);
    }, duration);
}

function dismissToast(toast) {
    if (!toast.parentNode) return;
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 350);
}

// Add progress bar animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes progressBar {
        0% { width: 100%; }
        100% { width: 0%; }
    }
`;
document.head.appendChild(styleSheet);

// ============================================================
// DARK MODE
// ============================================================

function toggleDarkMode() {
    state.darkMode = !state.darkMode;
    document.body.classList.toggle('dark-mode', state.darkMode);
    DOM.themeToggle.querySelector('.theme-icon').textContent = state.darkMode ? '☀️' : '🌙';
    saveToStorage('darkMode', state.darkMode);
    updateDarkModeStyles();
}

function updateDarkModeStyles() {
    if (state.darkMode) {
        document.body.style.background = 'linear-gradient(135deg, #0F172A 0%, #1a2a3a 100%)';
        document.body.style.color = '#E2E8F0';
        document.querySelectorAll('.glass-card, .panel, .map-wrapper').forEach(el => {
            el.classList.add('glass-card-dark');
        });
        document.querySelectorAll('.stat-card').forEach(el => {
            el.style.background = 'rgba(255,255,255,0.08)';
            el.style.borderColor = 'rgba(255,255,255,0.05)';
        });
        document.querySelectorAll('.panel-title, .map-title').forEach(el => {
            el.style.color = '#F1F5F9';
        });
        document.querySelectorAll('.feed-item, .log-entry').forEach(el => {
            el.style.background = 'rgba(255,255,255,0.05)';
            el.style.color = '#E2E8F0';
        });
        document.querySelectorAll('.modal-card').forEach(el => {
            el.style.background = 'rgba(30,41,59,0.9)';
            el.style.color = '#F1F5F9';
        });
        document.querySelectorAll('.stat-label').forEach(el => {
            el.style.color = 'rgba(255,255,255,0.6)';
        });
    } else {
        document.body.style.background = '';
        document.body.style.color = '';
        document.querySelectorAll('.glass-card, .panel, .map-wrapper').forEach(el => {
            el.classList.remove('glass-card-dark');
        });
        document.querySelectorAll('.stat-card').forEach(el => {
            el.style.background = '';
            el.style.borderColor = '';
        });
        document.querySelectorAll('.panel-title, .map-title').forEach(el => {
            el.style.color = '';
        });
        document.querySelectorAll('.feed-item, .log-entry').forEach(el => {
            el.style.background = '';
            el.style.color = '';
        });
        document.querySelectorAll('.modal-card').forEach(el => {
            el.style.background = '';
            el.style.color = '';
        });
        document.querySelectorAll('.stat-label').forEach(el => {
            el.style.color = '';
        });
    }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function initEventListeners() {
    // Theme toggle
    DOM.themeToggle.addEventListener('click', toggleDarkMode);
    
    // Modal close
    DOM.modalClose.addEventListener('click', closeRegionModal);
    DOM.modalCloseBtn.addEventListener('click', closeRegionModal);
    DOM.regionModal.addEventListener('click', (e) => {
        if (e.target === DOM.regionModal) closeRegionModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (state.modalOpen) closeRegionModal();
        }
    });
    
    // Deploy cleaning from modal
    DOM.modalDeploy.addEventListener('click', function() {
        const region = DOM.modalTitle.textContent;
        autoDeployCleaning(region);
        // Reset flags for this region
        const regionData = state.regions.find(r => r.name === region);
        if (regionData) {
            regionData.red_flags = 0;
            regionData.cleanliness_score = 85;
            regionData.last_cleaned = new Date().toISOString().slice(0, 10);
            saveToStorage('regions', state.regions);
            renderMarkers();
            updateStats();
            populateRegionSelect();
            closeRegionModal();
            showToast(`✅ Cleaning deployed to ${region}!`, 'success');
        }
    });
    
    // Heat map toggle
    DOM.heatToggle.addEventListener('click', function() {
        state.heatMap = !state.heatMap;
        this.textContent = state.heatMap ? '🗺️ Map View' : '🌡️ Heat Map';
        // Toggle heat map overlay (simplified: change marker opacity)
        document.querySelectorAll('.marker-dot').forEach(dot => {
            dot.style.opacity = state.heatMap ? '0.6' : '1';
        });
        showToast(state.heatMap ? '🌡️ Heat map activated' : '🗺️ Map view restored', 'info');
    });
    
    // Filter changes (debounced)
    const filterChange = debounce(() => {
        renderCleaningLog(true);
    }, 300);
    DOM.filterDate.addEventListener('change', filterChange);
    DOM.filterRegion.addEventListener('change', filterChange);
    DOM.filterStatus.addEventListener('change', filterChange);
    
    // Load more
    DOM.loadMoreBtn.addEventListener('click', () => {
        state.logPage++;
        renderCleaningLog(false);
    });
    
    // Window resize (throttled)
    const handleResize = throttle(() => {
        // Responsive adjustments
        if (window.innerWidth < 768) {
            // Mobile adjustments
        }
    }, 200);
    window.addEventListener('resize', handleResize);
    
    // Keyboard shortcut: dark mode (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggleDarkMode();
        }
    });
}

// ============================================================
// AUTO-REFRESH
// ============================================================

function startAutoRefresh() {
    // Refresh map markers
    setInterval(() => {
        renderMarkers();
        updateStats();
    }, CONFIG.REFRESH_INTERVAL);
    
    // Refresh activity feed
    setInterval(() => {
        updateActivityFeed();
    }, CONFIG.ACTIVITY_REFRESH);
}

// ============================================================
// INITIALIZATION
// ============================================================

async function init() {
    try {
        // Load data
        const loaded = await loadAllData();
        if (!loaded) {
            showToast('⚠️ Using cached data - some features may be limited', 'warning');
        }
        
        // Set year in footer
        DOM.year.textContent = new Date().getFullYear();
        
        // Initialize components
        initForm();
        renderMarkers();
        updateStats();
        updateActivityFeed();
        renderCleaningLog();
        initEventListeners();
        
        // Dark mode preference
        const savedDark = loadFromStorage('darkMode');
        if (savedDark !== null) {
            state.darkMode = savedDark;
        } else {
            // Check system preference
            state.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        if (state.darkMode) {
            document.body.classList.add('dark-mode');
            DOM.themeToggle.querySelector('.theme-icon').textContent = '☀️';
            updateDarkModeStyles();
        }
        
        // Start auto-refresh
        startAutoRefresh();
        
        // Show welcome toast
        setTimeout(() => {
            showToast('👋 Welcome to Haryana Waste Management Control', 'info', 3000);
        }, 500);
        
        console.log('✅ Haryana Waste Management Control initialized successfully');
        console.log(`📊 Loaded ${state.regions.length} regions, ${state.cleaningLog.length} log entries`);
        
    } catch (e) {
        console.error('Initialization error:', e);
        showToast('⚠️ Error loading application. Please refresh.', 'error');
    }
}

// ============================================================
// EXPOSE FOR DEBUGGING
// ============================================================
window.__HWM = {
    state,
    loadAllData,
    renderMarkers,
    updateStats,
    showToast,
    exportCSV: () => exportCSV(state.cleaningLog, 'cleaning_log')
};

// ============================================================
// START APP
// ============================================================
document.addEventListener('DOMContentLoaded', init);