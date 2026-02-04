/* ============================================
   JEE STUDY TRACKER - LEADERBOARD
   ============================================ */

let currentUser = null;
let currentPeriod = 'weekly';
let currentCategory = 'hours';

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuth();
    if (!currentUser) return;
    
    // Set current user name in nav
    document.getElementById('current-user-name').textContent = currentUser.name;
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial leaderboard
    await loadLeaderboard();
});

// Setup event listeners
function setupEventListeners() {
    // Period tabs
    document.querySelectorAll('.period-tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.period-tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPeriod = tab.dataset.period;
            loadLeaderboard();
        });
    });
    
    // Category tabs
    document.querySelectorAll('.category-tabs .cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tabs .cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            loadLeaderboard();
        });
    });
}

// Load leaderboard
async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-content');
    
    // Show loading
    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner spinner-lg"></div>
            <p>Loading leaderboard...</p>
        </div>
    `;
    
    try {
        const data = await apiCall(`/api/leaderboard/${currentPeriod}/${currentCategory}`);
        const rankings = data.rankings || [];
        
        if (rankings.length === 0) {
            container.innerHTML = `
                <div class="empty-leaderboard">
                    <div class="empty-leaderboard-icon">🏆</div>
                    <h3>No data yet</h3>
                    <p>Complete some tasks to appear on the leaderboard!</p>
                </div>
            `;
            return;
        }
        
        // Render rankings
        container.innerHTML = rankings.map((rank, index) => {
            const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
            const badgeClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'other';
            const badgeText = index < 3 ? (index === 0 ? '🏆' : `#${index + 1}`) : `#${index + 1}`;
            const gradient = getGradientForUser(rank.user_id);
            
            let primaryValue = rank.primary_value;
            let primaryLabel = '';
            
            if (currentCategory === 'hours') {
                primaryValue = primaryValue.toFixed(1);
                primaryLabel = 'hours';
            } else if (currentCategory === 'success') {
                primaryValue = primaryValue + '%';
                primaryLabel = 'success rate';
            } else if (currentCategory === 'problems') {
                primaryLabel = 'problems';
            } else if (currentCategory === 'tasks') {
                primaryLabel = 'tasks';
            }
            
            return `
                <div class="leaderboard-card ${rankClass}">
                    <div class="rank-badge ${badgeClass}">${badgeText}</div>
                    <div class="user-info">
                        <div class="avatar user-avatar gradient-${gradient}">${rank.user_name.charAt(0)}</div>
                        <div class="user-details">
                            <h3>${rank.user_name}</h3>
                            <p>${rank.secondary_stats.tasks_completed} tasks • ${rank.secondary_stats.tasks_ontime} on-time</p>
                        </div>
                    </div>
                    <div class="rank-stats">
                        <div class="primary-stat">${primaryValue}</div>
                        <div class="secondary-stats">
                            ${currentCategory !== 'hours' ? `${rank.secondary_stats.hours_total}h • ` : ''}
                            ${currentCategory !== 'problems' ? `${rank.secondary_stats.problems_total} problems • ` : ''}
                            ${rank.secondary_stats.success_rate}% success
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        container.innerHTML = `
            <div class="empty-leaderboard">
                <div class="empty-leaderboard-icon">❌</div>
                <h3>Failed to load leaderboard</h3>
                <p>Please try again later</p>
            </div>
        `;
        console.error('Failed to load leaderboard:', error);
    }
}
