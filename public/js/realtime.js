/**
 * Real-time Updates Module for JEE Study Tracker
 * Uses Server-Sent Events with polling fallback
 */

let eventSource = null;
let pollInterval = null;
let liveFeedData = [];

// Initialize real-time updates
function initRealtimeUpdates() {
    // Only initialize on dashboard
    if (!document.getElementById('liveFeed')) return;

    // Try SSE first
    try {
        initSSE();
    } catch (error) {
        console.log('SSE not available, using polling');
        initPolling();
    }

    // Initial load
    loadLiveFeed();
    loadLeaderboardPreview();
    loadGroupStats();
}

// Initialize Server-Sent Events
function initSSE() {
    eventSource = new EventSource('/api/stream');
    
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            updateLiveFeed(data);
        } catch (error) {
            console.error('Error parsing SSE data:', error);
        }
    };

    eventSource.onerror = (error) => {
        console.log('SSE error, falling back to polling');
        eventSource.close();
        initPolling();
    };
}

// Initialize polling fallback
function initPolling() {
    // Poll every 5 seconds
    pollInterval = setInterval(() => {
        loadLiveFeed();
        loadLeaderboardPreview();
        loadGroupStats();
    }, 5000);
}

// Load live feed data
async function loadLiveFeed() {
    try {
        const users = await api('/api/feed/active');
        if (users) {
            updateLiveFeed(users);
        }
    } catch (error) {
        console.error('Failed to load live feed:', error);
    }
}

// Update live feed UI
function updateLiveFeed(users) {
    const container = document.getElementById('liveFeed');
    if (!container) return;

    liveFeedData = users;

    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p>No friends registered yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = users.map(user => {
        const isActive = user.activeTask !== null;
        const initials = getInitials(user.name);
        const todayTotal = user.todayStats.ontime + user.todayStats.delayed;
        const successRate = todayTotal > 0 
            ? Math.round((user.todayStats.ontime / todayTotal) * 100) 
            : 0;

        return `
            <div class="user-card ${isActive ? 'active' : ''}" data-user-id="${user.id}">
                <div class="user-card-header">
                    <div class="avatar">${initials}</div>
                    <div class="user-card-info">
                        <h4>${escapeHtml(user.name)}</h4>
                    </div>
                </div>
                <div class="user-current-task ${isActive ? 'active' : ''}">
                    ${isActive ? `
                        <span class="status-indicator active"></span>
                        <span>${user.activeTask.subject || 'Other'}: ${escapeHtml(user.activeTask.name)}</span>
                        <span class="timer-badge">${formatTime(user.activeTask.elapsedMinutes)}</span>
                    ` : `
                        <span class="status-indicator idle"></span>
                        <span>Idle</span>
                    `}
                </div>
                <div class="user-quick-stats">
                    <span>✅ ${user.todayStats.ontime}</span>
                    <span>⏰ ${user.todayStats.delayed}</span>
                    <span>📊 ${todayTotal}</span>
                    <span>${successRate}%</span>
                </div>
                <a href="/profile?user=${user.id}" class="btn btn-secondary btn-sm btn-full" style="margin-top: 0.75rem;">
                    View Profile
                </a>
            </div>
        `;
    }).join('');
}

// Load leaderboard preview
async function loadLeaderboardPreview() {
    try {
        const users = await api('/api/leaderboard/weekly');
        if (users) {
            renderLeaderboardPreview(users);
        }
    } catch (error) {
        console.error('Failed to load leaderboard preview:', error);
    }
}

// Render leaderboard preview
function renderLeaderboardPreview(users) {
    const container = document.getElementById('leaderboardPreview');
    if (!container) return;

    const topUsers = users.slice(0, 3);
    
    if (topUsers.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No data yet</p>';
        return;
    }

    container.innerHTML = topUsers.map((user, index) => {
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze';
        return `
            <div class="leaderboard-item">
                <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                <div class="leaderboard-name">${escapeHtml(user.name)}</div>
                <div class="leaderboard-score">${user.ontime_tasks || 0} ✅</div>
            </div>
        `;
    }).join('');
}

// Load group stats
async function loadGroupStats() {
    try {
        const users = await api('/api/users');
        if (users) {
            calculateGroupStats(users);
        }
    } catch (error) {
        console.error('Failed to load group stats:', error);
    }
}

// Calculate and display group stats
function calculateGroupStats(users) {
    let totalTasks = 0;
    let totalOntime = 0;
    let totalDelayed = 0;
    let totalMinutes = 0;

    users.forEach(user => {
        totalTasks += user.total_tasks || 0;
        totalOntime += user.ontime_tasks || 0;
        totalDelayed += user.delayed_tasks || 0;
    });

    const completedTasks = totalOntime + totalDelayed;
    const successRate = completedTasks > 0 ? Math.round((totalOntime / completedTasks) * 100) : 0;
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

    // Update UI
    const totalTasksEl = document.getElementById('groupTotalTasks');
    const studyHoursEl = document.getElementById('groupStudyHours');
    const successRateEl = document.getElementById('groupSuccessRate');

    if (totalTasksEl) totalTasksEl.textContent = completedTasks;
    if (studyHoursEl) studyHoursEl.textContent = totalHours + 'h';
    if (successRateEl) successRateEl.textContent = successRate + '%';
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
    if (pollInterval) {
        clearInterval(pollInterval);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', initRealtimeUpdates);
