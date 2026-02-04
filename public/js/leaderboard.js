/**
 * Leaderboard Module for JEE Study Tracker
 */

let currentTab = 'weekly';

// Initialize leaderboard page
document.addEventListener('DOMContentLoaded', () => {
    // Only run on leaderboard page
    if (!document.getElementById('leaderboardContent')) return;

    // Setup tabs
    setupTabs();

    // Load initial data
    loadLeaderboard('weekly');
});

// Setup tab listeners
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Load data for selected tab
            const period = tab.dataset.tab;
            currentTab = period;
            loadLeaderboard(period);
        });
    });
}

// Load leaderboard data
async function loadLeaderboard(period) {
    const container = document.getElementById('leaderboardContent');
    if (!container) return;

    // Show loading
    container.innerHTML = `
        <div class="leaderboard-loading">
            <div class="spinner"></div>
            <p>Loading leaderboard...</p>
        </div>
    `;

    try {
        const users = await api(`/api/leaderboard/${period}`);
        if (users) {
            renderLeaderboard(users);
            renderPodium(users.slice(0, 3));
        }
    } catch (error) {
        container.innerHTML = `
            <div class="leaderboard-empty">
                <div class="leaderboard-empty-icon">⚠️</div>
                <h3>Failed to load leaderboard</h3>
                <p>${error.message || 'Please try again later'}</p>
            </div>
        `;
    }
}

// Render leaderboard
function renderLeaderboard(users) {
    const container = document.getElementById('leaderboardContent');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = `
            <div class="leaderboard-empty">
                <div class="leaderboard-empty-icon">📊</div>
                <h3>No data yet</h3>
                <p>Start completing tasks to appear on the leaderboard!</p>
            </div>
        `;
        return;
    }

    // Skip top 3 for main list (they're in podium)
    const remainingUsers = users.slice(3);

    if (remainingUsers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Top 3 shown above!</p>';
        return;
    }

    container.innerHTML = remainingUsers.map(user => {
        const initials = getInitials(user.name);
        
        return `
            <div class="leaderboard-card">
                <div class="rank-badge">#${user.rank}</div>
                <div class="leaderboard-user">
                    <div class="avatar">${initials}</div>
                    <div class="leaderboard-user-info">
                        <h3>${escapeHtml(user.name)}</h3>
                        <p>${user.total_tasks || 0} tasks completed</p>
                    </div>
                </div>
                <div class="leaderboard-stats">
                    <div class="stat-box">
                        <div class="stat-box-value">${user.ontime_tasks || 0}</div>
                        <div class="stat-box-label">On Time</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-value">${user.successRate}%</div>
                        <div class="stat-box-label">Success</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-value">${user.hours || 0}h</div>
                        <div class="stat-box-label">Hours</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render podium (top 3)
function renderPodium(topUsers) {
    const podium = document.getElementById('podium');
    if (!podium) return;

    if (topUsers.length === 0) {
        podium.style.display = 'none';
        return;
    }

    podium.style.display = 'flex';

    // Reorder for podium display: 2nd, 1st, 3rd
    const ordered = [];
    if (topUsers[1]) ordered.push({ ...topUsers[1], position: 'second' });
    if (topUsers[0]) ordered.push({ ...topUsers[0], position: 'first' });
    if (topUsers[2]) ordered.push({ ...topUsers[2], position: 'third' });

    podium.innerHTML = ordered.map(user => {
        const initials = getInitials(user.name);
        const rank = user.position === 'first' ? 1 : user.position === 'second' ? 2 : 3;
        
        return `
            <div class="podium-item ${user.position}">
                <div class="podium-avatar">
                    ${initials}
                    <div class="podium-rank">${rank}</div>
                </div>
                <div class="podium-name">${escapeHtml(user.name)}</div>
                <div class="podium-stats">
                    ${user.ontime_tasks || 0} on-time • ${user.successRate}% success
                </div>
                <div class="podium-base">${rank}</div>
            </div>
        `;
    }).join('');
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
