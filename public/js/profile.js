/* ============================================
   JEE STUDY TRACKER - PROFILE
   Complete Transparency - View Everything
   ============================================ */

let currentUser = null;
let viewingUserId = null;
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await checkAuth();
    if (!currentUser) return;
    
    // Set current user name in nav
    document.getElementById('current-user-name').textContent = currentUser.name;
    
    // Get userId from URL params
    const urlParams = new URLSearchParams(window.location.search);
    viewingUserId = parseInt(urlParams.get('userId')) || currentUser.id;
    
    // Load all users for switcher
    await loadAllUsers();
    
    // Load profile data
    await loadProfile(viewingUserId);
    
    // Setup event listeners
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // User switcher
    document.getElementById('user-select')?.addEventListener('change', (e) => {
        const userId = parseInt(e.target.value);
        if (userId) {
            window.location.href = `/profile.html?userId=${userId}`;
        }
    });
    
    // History filters
    document.getElementById('apply-filters')?.addEventListener('click', () => {
        loadTaskHistory();
    });
}

// Load all users
async function loadAllUsers() {
    try {
        const data = await apiCall('/api/users');
        allUsers = data.users || [];
        
        // Populate user switcher
        const select = document.getElementById('user-select');
        select.innerHTML = allUsers.map(user => 
            `<option value="${user.id}" ${user.id === viewingUserId ? 'selected' : ''}>${user.name}</option>`
        ).join('');
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Load profile data
async function loadProfile(userId) {
    try {
        // Get user profile
        const profile = await apiCall(`/api/users/${userId}/profile`);
        
        // Update profile header
        document.getElementById('profile-avatar').textContent = profile.user.name.charAt(0).toUpperCase();
        document.getElementById('profile-avatar').className = `avatar profile-avatar gradient-${getGradientForUser(profile.user.id)}`;
        document.getElementById('profile-name').textContent = profile.user.name;
        document.getElementById('profile-username').textContent = `@${profile.user.username}`;
        document.getElementById('profile-joined').textContent = formatDate(profile.user.created_at);
        document.getElementById('current-streak').textContent = profile.user.current_streak || 0;
        document.getElementById('best-streak').textContent = profile.user.best_streak || 0;
        
        // Update stats overview
        document.getElementById('total-hours').textContent = profile.overall_stats.total_hours + 'h';
        document.getElementById('total-problems').textContent = profile.overall_stats.total_problems;
        document.getElementById('total-tasks').textContent = profile.overall_stats.total_tasks;
        document.getElementById('success-rate').textContent = profile.overall_stats.success_rate + '%';
        
        // Update subject breakdown
        updateSubjectBreakdown(profile.subject_breakdown);
        
        // Load weekly chart
        await loadWeeklyChart(userId);
        
        // Load today's todo
        await loadTodayTodo(userId);
        
        // Load recent summaries
        await loadRecentSummaries(userId);
        
        // Load task history
        await loadTaskHistory();
        
    } catch (error) {
        showToast('Failed to load profile', 'error');
        console.error(error);
    }
}

// Update subject breakdown
function updateSubjectBreakdown(breakdown) {
    // 1. Add 'biology' to this list
    const subjects = ['maths', 'physics', 'chemistry', 'biology'];
    
    // Calculate total hours including Biology
    const totalHours = subjects.reduce((sum, s) => sum + (breakdown[s]?.hours || 0), 0);
    
    subjects.forEach(subject => {
        const data = breakdown[subject];
        
        // 2. Check if the elements exist before updating (Safety check)
        const problemEl = document.getElementById(`${subject}-problems-total`);
        const hoursEl = document.getElementById(`${subject}-hours`);
        const tasksEl = document.getElementById(`${subject}-tasks`);
        const progressEl = document.getElementById(`${subject}-progress`);

        if (problemEl && hoursEl && tasksEl && progressEl) {
            problemEl.textContent = data.problems;
            hoursEl.textContent = Math.round(data.hours * 10) / 10 + 'h';
            tasksEl.textContent = data.tasks;
            
            // Update progress bar
            const percentage = totalHours > 0 ? (data.hours / totalHours) * 100 : 0;
            progressEl.style.width = percentage + '%';
        }
    });
}

// Load weekly chart
async function loadWeeklyChart(userId) {
    try {
        const data = await apiCall(`/api/stats/user/${userId}/weekly`);
        const days = data.days || [];
        
        const chartContainer = document.getElementById('week-chart');
        
        if (days.length === 0 || days.every(d => d.hours === 0)) {
            chartContainer.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">📊</div>
                    <p>No data for this week</p>
                </div>
            `;
            return;
        }
        
        const maxHours = Math.max(...days.map(d => d.hours), 1);
        
        chartContainer.innerHTML = days.map(day => {
            const height = (day.hours / maxHours) * 100;
            return `
                <div class="chart-bar-container">
                    <div class="chart-value">${day.hours}h</div>
                    <div class="chart-bar" style="height: ${Math.max(height, 4)}%"></div>
                    <div class="chart-label">${day.day_name}</div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load weekly chart:', error);
    }
}

// Load today's todo
async function loadTodayTodo(userId) {
    try {
        const data = await apiCall(`/api/users/${userId}/tasks/today`);
        
        // Update user name
        document.getElementById('user-name-todo').textContent = data.user_name + "'s";
        
        // Update summary
        document.getElementById('todo-pending').textContent = data.summary.pending;
        document.getElementById('todo-active').textContent = data.summary.in_progress;
        document.getElementById('todo-done').textContent = data.summary.completed;
        
        // Render tasks
        const todoList = document.getElementById('profile-todo-list');
        
        if (data.tasks.length === 0) {
            todoList.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">📝</div>
                    <p>No tasks planned for today</p>
                </div>
            `;
            return;
        }
        
        todoList.innerHTML = data.tasks.map(task => {
            const statusClass = task.status.replace('_', '-');
            const statusIcon = getStatusIcon(task.status);
            
            return `
                <div class="todo-item ${statusClass}">
                    <div class="todo-status-icon">${statusIcon}</div>
                    <div class="todo-content">
                        <div class="todo-name">${task.task_name}</div>
                        <div class="todo-meta">
                            <span class="subject-tag ${task.subject.toLowerCase()}">${task.subject}</span>
                            <span>⏱️ Est: ${formatMinutes(task.estimated_minutes)}</span>
                            ${task.actual_minutes ? `<span>✓ Actual: ${formatMinutes(task.actual_minutes)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load today\'s todo:', error);
    }
}

// Load recent summaries
async function loadRecentSummaries(userId) {
    try {
        const data = await apiCall(`/api/users/${userId}/summaries?limit=5`);
        const summaries = data.summaries || [];
        
        const container = document.getElementById('summaries-list');
        
        if (summaries.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">📅</div>
                    <p>No daily summaries yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = summaries.map(summary => {
            const stars = '⭐'.repeat(summary.self_rating || 0);
            
            return `
                <div class="summary-card">
                    <div class="summary-header">
                        <span class="summary-date">${formatShortDate(summary.summary_date)}</span>
                        <span class="summary-rating">${stars}</span>
                    </div>
                    <div class="summary-problems">
                        <span class="problem-stat maths">📐 ${summary.maths_problems}</span>
                        <span class="problem-stat physics">⚛️ ${summary.physics_problems}</span>
                        <span class="problem-stat chemistry">🧪 ${summary.chemistry_problems}</span>
                        <span class="problem-stat biology">🧬 ${summary.biology_problems || 0}</span>
                    </div>
                    ${summary.topics_covered ? `
                        <div class="summary-topics">
                            <strong>Topics:</strong> ${summary.topics_covered}
                        </div>
                    ` : ''}
                    ${summary.notes ? `
                        <div class="summary-notes">
                            <strong>Notes:</strong> ${summary.notes}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load summaries:', error);
    }
}

// Load task history
async function loadTaskHistory() {
    try {
        const startDate = document.getElementById('history-start')?.value || '';
        const endDate = document.getElementById('history-end')?.value || '';
        const subject = document.getElementById('history-subject')?.value || '';
        
        let url = `/api/users/${viewingUserId}/tasks/history`;
        const params = [];
        
        if (startDate) params.push(`startDate=${startDate}`);
        if (endDate) params.push(`endDate=${endDate}`);
        if (subject) params.push(`subject=${subject}`);
        
        if (params.length > 0) {
            url += '?' + params.join('&');
        }
        
        const data = await apiCall(url);
        const tasks = data.tasks || [];
        
        const tbody = document.getElementById('history-tbody');
        
        if (tasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: var(--space-xl);">
                        No tasks found
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = tasks.map(task => {
            const statusClass = task.status.replace('_', '-');
            
            return `
                <tr>
                    <td>${formatShortDate(task.task_date)}</td>
                    <td>${task.task_name}</td>
                    <td><span class="subject-tag ${task.subject.toLowerCase()}">${task.subject}</span></td>
                    <td>${formatMinutes(task.estimated_minutes)}</td>
                    <td>${task.actual_minutes ? formatMinutes(task.actual_minutes) : '-'}</td>
                    <td><span class="status-badge ${statusClass}">${getStatusLabel(task.status)}</span></td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load task history:', error);
    }
}
