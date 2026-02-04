/**
 * Profile Module for JEE Study Tracker
 */

let currentProfileUserId = null;

// Initialize profile page
document.addEventListener('DOMContentLoaded', async () => {
    // Only run on profile page
    if (!document.getElementById('profileHeader')) return;

    // Get user ID from URL or use current user
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    
    if (userId) {
        currentProfileUserId = parseInt(userId);
    } else if (window.currentUser) {
        currentProfileUserId = window.currentUser.id;
    }

    if (currentProfileUserId) {
        await loadProfile(currentProfileUserId);
        await loadTaskHistory(currentProfileUserId);
    }

    // Setup filter listeners
    setupFilters();
});

// Load user profile
async function loadProfile(userId) {
    try {
        const data = await api(`/api/users/${userId}/profile`);
        if (!data) return;

        renderProfileHeader(data.user);
        renderProfileStats(data.stats);
        renderWeekStats(data.weekStats);
        renderHeatmap(data.history);
        renderHistoryList(data.history);
    } catch (error) {
        showToast('Failed to load profile', 'error');
    }
}

// Render profile header
function renderProfileHeader(user) {
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const username = document.getElementById('profileUsername');
    const joinDate = document.getElementById('profileJoinDate');

    if (avatar) avatar.textContent = getInitials(user.name);
    if (name) name.textContent = user.name;
    if (username) username.textContent = `@${user.username}`;
    if (joinDate) {
        const date = new Date(user.created_at);
        joinDate.textContent = `Member since ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    }
}

// Render profile stats
function renderProfileStats(stats) {
    const container = document.getElementById('profileStats');
    if (!container) return;

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.successRate}%</div>
            <div class="stat-label">Success Rate</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.totalHours}h</div>
            <div class="stat-label">Study Hours</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${window.currentUser?.current_streak || 0}🔥</div>
            <div class="stat-label">Current Streak</div>
        </div>
    `;
}

// Render week stats
function renderWeekStats(stats) {
    const container = document.getElementById('weekStats');
    if (!container) return;

    container.innerHTML = `
        <div class="week-stat-item">
            <div class="week-stat-value">${stats.total}</div>
            <div class="week-stat-label">Tasks Completed</div>
        </div>
        <div class="week-stat-item">
            <div class="week-stat-value">${stats.successRate}%</div>
            <div class="week-stat-label">Success Rate</div>
        </div>
        <div class="week-stat-item">
            <div class="week-stat-value">${stats.hours}h</div>
            <div class="week-stat-label">Hours Studied</div>
        </div>
    `;
}

// Render heatmap
function renderHeatmap(history) {
    const container = document.getElementById('heatmapGrid');
    if (!container) return;

    // Generate last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push({
            date: date.toISOString().split('T')[0],
            tasks: 0
        });
    }

    // Fill in actual data
    history.forEach(day => {
        const dayEntry = days.find(d => d.date === day.task_date);
        if (dayEntry) {
            dayEntry.tasks = day.total;
        }
    });

    // Find max for scaling
    const maxTasks = Math.max(...days.map(d => d.tasks), 1);

    // Render cells
    container.innerHTML = days.map(day => {
        const level = day.tasks === 0 ? 0 : 
                      day.tasks <= maxTasks * 0.25 ? 1 :
                      day.tasks <= maxTasks * 0.5 ? 2 :
                      day.tasks <= maxTasks * 0.75 ? 3 : 4;
        
        return `
            <div class="heatmap-cell level-${level}" 
                 title="${day.date}: ${day.tasks} tasks"></div>
        `;
    }).join('');
}

// Render history list
function renderHistoryList(history) {
    const container = document.getElementById('historyList');
    if (!container) return;

    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No study history yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = history.map(day => {
        const total = day.ontime + day.delayed;
        const successRate = total > 0 ? Math.round((day.ontime / total) * 100) : 0;
        
        return `
            <div class="history-item">
                <div class="history-date">${formatDate(day.task_date)}</div>
                <div class="history-stats">
                    <span>✅ ${day.ontime}</span>
                    <span>⏰ ${day.delayed}</span>
                    <span>📊 ${total} tasks</span>
                </div>
                <div class="history-success-rate">${successRate}%</div>
            </div>
        `;
    }).join('');
}

// Load task history
async function loadTaskHistory(userId, filters = {}) {
    try {
        let url = `/api/tasks/user/${userId}`;
        const params = new URLSearchParams();
        
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.subject && filters.subject !== 'All') params.append('subject', filters.subject);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }

        const tasks = await api(url);
        renderTaskHistoryTable(tasks || []);
    } catch (error) {
        showToast('Failed to load task history', 'error');
    }
}

// Render task history table
function renderTaskHistoryTable(tasks) {
    const tbody = document.getElementById('taskHistoryTable');
    if (!tbody) return;

    if (tasks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    No tasks found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = tasks.map(task => {
        const statusInfo = getStatusInfo(task.status);
        
        return `
            <tr>
                <td>${formatDate(task.task_date)}</td>
                <td>${escapeHtml(task.task_name)}</td>
                <td><span class="subject-tag ${getSubjectClass(task.subject)}">${task.subject || 'Other'}</span></td>
                <td>${formatTime(task.estimated_minutes)}</td>
                <td>${task.actual_minutes ? formatTime(task.actual_minutes) : '-'}</td>
                <td>
                    <span class="status-badge ${statusInfo.class.replace('completed_', '')}">
                        ${statusInfo.text}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Setup filter listeners
function setupFilters() {
    const applyBtn = document.getElementById('applyFilters');
    if (!applyBtn) return;

    applyBtn.addEventListener('click', () => {
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        const subject = document.getElementById('subjectFilter')?.value;

        loadTaskHistory(currentProfileUserId, { startDate, endDate, subject });
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
